// Meta (Facebook) Lead Ads API Integration

const META_GRAPH_API = "https://graph.facebook.com/v18.0";

export interface MetaTokens {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface MetaLeadData {
  id: string;
  created_time: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  form_name?: string;
}

export interface ParsedLead {
  meta_lead_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  created_at: string;
  ad_name: string | null;
  campaign_name: string | null;
  form_name: string | null;
  raw_data: MetaLeadData;
}

export function getMetaAuthUrl() {
  const clientId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Meta App ID or Redirect URI not configured");
  }

  const scopes = [
    "leads_retrieval",
    "pages_show_list",
    "pages_read_engagement",
    "ads_management",
    "business_management",
  ].join(",");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state: generateState(),
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

function generateState(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function exchangeCodeForToken(code: string): Promise<MetaTokens> {
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Meta credentials not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(
    `${META_GRAPH_API}/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to exchange code for token");
  }

  return response.json();
}

export async function getLongLivedToken(shortLivedToken: string): Promise<MetaTokens> {
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Meta credentials not configured");
  }

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `${META_GRAPH_API}/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to get long-lived token");
  }

  return response.json();
}

export async function getPages(accessToken: string): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const response = await fetch(
    `${META_GRAPH_API}/me/accounts?access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch pages");
  }

  const data = await response.json();
  return data.data || [];
}

export async function getAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string; account_id: string }>> {
  const response = await fetch(
    `${META_GRAPH_API}/me/adaccounts?fields=id,name,account_id&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch ad accounts");
  }

  const data = await response.json();
  return data.data || [];
}

export async function getLeadGenForms(pageId: string, pageAccessToken: string): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(
    `${META_GRAPH_API}/${pageId}/leadgen_forms?access_token=${pageAccessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch lead gen forms");
  }

  const data = await response.json();
  return data.data || [];
}

export async function getLeadDetails(leadId: string, accessToken: string): Promise<MetaLeadData> {
  const response = await fetch(
    `${META_GRAPH_API}/${leadId}?fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch lead details");
  }

  return response.json();
}

export async function getFormLeads(
  formId: string,
  accessToken: string,
  limit: number = 50
): Promise<MetaLeadData[]> {
  const response = await fetch(
    `${META_GRAPH_API}/${formId}/leads?fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name&limit=${limit}&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch form leads");
  }

  const data = await response.json();
  return data.data || [];
}

export function parseLeadData(lead: MetaLeadData): ParsedLead {
  const fieldMap: Record<string, string> = {};

  for (const field of lead.field_data || []) {
    fieldMap[field.name.toLowerCase()] = field.values[0] || "";
  }

  // Common field names used in Meta Lead Ads
  const name = fieldMap["full_name"] ||
               fieldMap["name"] ||
               `${fieldMap["first_name"] || ""} ${fieldMap["last_name"] || ""}`.trim() ||
               "Unknown";

  const email = fieldMap["email"] ||
                fieldMap["work_email"] ||
                "";

  const phone = fieldMap["phone_number"] ||
                fieldMap["phone"] ||
                fieldMap["mobile_number"] ||
                null;

  const company = fieldMap["company_name"] ||
                  fieldMap["company"] ||
                  fieldMap["business_name"] ||
                  null;

  return {
    meta_lead_id: lead.id,
    name,
    email,
    phone,
    company,
    created_at: lead.created_time,
    ad_name: lead.ad_name || null,
    campaign_name: lead.campaign_name || null,
    form_name: null, // Will be populated if available
    raw_data: lead,
  };
}

export async function subscribeToPageWebhook(
  pageId: string,
  pageAccessToken: string
): Promise<boolean> {
  const response = await fetch(
    `${META_GRAPH_API}/${pageId}/subscribed_apps`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: pageAccessToken,
        subscribed_fields: ["leadgen"],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to subscribe to webhook");
  }

  const data = await response.json();
  return data.success === true;
}

export async function getUserInfo(accessToken: string): Promise<{ id: string; name: string; email?: string }> {
  const response = await fetch(
    `${META_GRAPH_API}/me?fields=id,name,email&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch user info");
  }

  return response.json();
}

// Webhook verification helper
export function verifyWebhookSignature(
  signature: string,
  payload: string
): boolean {
  const crypto = require("crypto");
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    console.error("META_APP_SECRET not configured");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  return signature === `sha256=${expectedSignature}`;
}
