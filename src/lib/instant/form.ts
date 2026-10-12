// Normalises a Meta lead posted by Zapier into one shape.
//
// Zapier's "Webhooks by Zapier" POST can send mapped fields under any key names, or (with Data left
// empty) the raw lead from the trigger. Meta form answers can also arrive as
// field_data: [{ name, values: [...] }]. Keys are matched loosely so the Zap mapping isn't fragile.

export type HelpArea = "social_media" | "website" | "google_ads" | "meta_ads" | "seo" | "other";

export interface InstantLeadForm {
  name: string; // as typed in the form; can be a business name by mistake ("Legion13 Perth | BJJ")
  email: string;
  phone: string | null;
  company: string;
  website: string | null; // https://host/ (social profile links are moved to socialLinks)
  socialLinks: string[];
  trade: string;
  helpWith: HelpArea[];
  helpWithRaw: string;
  platform: string | null; // fb or ig
  adName: string | null;
  adsetName: string | null;
  campaignName: string | null;
  formName: string | null;
  metaLeadId: string | null;
  createdTime: string | null;
  // The lead has already had an email from us (e.g. the old Zapier email), so this one follows up
  previouslyEmailed: boolean;
  // Best guesses at the business name to look up, most likely first
  businessCandidates: string[];
  emailDomain: string | null; // null for free mail (gmail, hotmail, bigpond ...)
}

const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|aol|proton|protonmail|bigpond|optusnet|tpg|iinet|internode|westnet|dodo|y7mail|gmx|zoho)\./i;
const SOCIAL_HOSTS = /(^|\.)(facebook|fb|instagram|tiktok|linkedin|youtube|x|twitter|linktr)\.(com|ee|me)$/i;
const BUSINESS_WORDS = /\b(pty|ltd|limited|group|services?|studio|co|company|club|gym|academy|clinic|plumbing|electrical|building|constructions?|cafe|bar|salon|store|shop|perth|sydney|melbourne|brisbane|adelaide|hobart|darwin|canberra|gold coast)\b|[|&@\d]/i;

function keyOf(k: string) {
  return k.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// Flattens nested objects and Meta field_data arrays into { normalised_key: string }
function flatten(input: unknown, out: Record<string, string> = {}, prefix = ""): Record<string, string> {
  if (input === null || input === undefined) return out;
  if (Array.isArray(input)) {
    for (const item of input) {
      if (item && typeof item === "object" && "name" in item && "values" in item) {
        const values = (item as { values?: unknown }).values;
        const v = Array.isArray(values) ? values.join(", ") : String(values ?? "");
        out[keyOf(String((item as { name: unknown }).name))] = v;
      } else {
        flatten(item, out, prefix);
      }
    }
    return out;
  }
  if (typeof input === "object") {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const key = prefix ? `${prefix}_${keyOf(k)}` : keyOf(k);
      if (v !== null && typeof v === "object") flatten(v, out, keyOf(k) === "field_data" ? "" : key);
      else if (v !== null && v !== undefined && String(v).trim() !== "") out[key] = String(v).trim();
    }
  }
  return out;
}

function pick(f: Record<string, string>, exact: string[], contains: RegExp[] = []): string {
  for (const k of exact) if (f[k]) return f[k];
  for (const re of contains) {
    const k = Object.keys(f).find((key) => re.test(key) && f[key]);
    if (k) return f[k];
  }
  return "";
}

export function parseHelpWith(raw: string): HelpArea[] {
  const s = raw.toLowerCase();
  const areas = new Set<HelpArea>();
  if (/social/.test(s)) areas.add("social_media");
  if (/web/.test(s)) areas.add("website");
  if (/google/.test(s) && /ad/.test(s)) areas.add("google_ads");
  if (/(meta|facebook|instagram)[ _-]?ads?/.test(s) || /^meta/.test(s)) areas.add("meta_ads");
  if (/seo|search|maps|google business|ranking/.test(s)) areas.add("seo");
  if (areas.size === 0 && s.trim()) areas.add("other");
  return [...areas];
}

export function normaliseUrl(raw: string): string | null {
  let s = raw.trim().replace(/\s+/g, "");
  if (!s || /^(none|n\/a|na|no|-|nil|not yet)$/i.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname.includes(".")) return null;
    return `https://${u.hostname.toLowerCase()}${u.pathname === "/" ? "/" : u.pathname}`;
  } catch {
    return null;
  }
}

function looksLikeBusiness(s: string) {
  return BUSINESS_WORDS.test(s) || s.trim().split(/\s+/).length >= 4;
}

export function normaliseLeadPayload(body: unknown): InstantLeadForm {
  const f = flatten(body);

  const first = pick(f, ["first_name"]);
  const last = pick(f, ["last_name"]);
  const name = pick(f, ["full_name", "name"], [/^full_?name/, /contact_name/]) || `${first} ${last}`.trim();
  const email = pick(f, ["email", "work_email", "email_address"], [/email/]).toLowerCase();
  const phone = pick(f, ["phone_number", "phone", "mobile", "mobile_number"], [/phone|mobile/]) || null;
  const company = pick(f, ["company_name", "company", "business_name", "business"], [/company|business_name/]);
  const websiteRaw = pick(f, ["website", "website_url", "your_website", "url"], [/website/]);
  const helpWithRaw = pick(f, [], [/help/, /interested_in|looking_for/]);
  const trade = pick(f, [], [/trade|industry|service|what_do_you_do|type_of_business/]);

  let website: string | null = null;
  const socialLinks: string[] = [];
  const w = websiteRaw ? normaliseUrl(websiteRaw) : null;
  if (w) {
    if (SOCIAL_HOSTS.test(new URL(w).hostname)) socialLinks.push(w);
    else website = w;
  }

  const domain = email.includes("@") ? email.split("@")[1] : "";
  const emailDomain = domain && !FREE_MAIL.test(domain) ? domain : null;
  if (!website && emailDomain) website = `https://${emailDomain}/`;

  // When the name field holds the business and the company field holds a person's name, swap them
  const candidates: string[] = [];
  const nameIsBusiness = name && looksLikeBusiness(name);
  const companyIsPerson = company && !looksLikeBusiness(company) && company.trim().split(/\s+/).length <= 2;
  if (nameIsBusiness && companyIsPerson) candidates.push(name, company);
  else candidates.push(company, name);
  const businessCandidates = [...new Set(candidates.map((c) => c.split("|")[0].replace(/[,&]+\s*$/, "").trim()).filter(Boolean))];

  const previously = pick(f, ["previously_emailed"]);

  return {
    name,
    email,
    phone,
    company,
    website,
    socialLinks,
    trade,
    helpWith: parseHelpWith(helpWithRaw),
    helpWithRaw,
    platform: pick(f, ["platform"]) || null,
    adName: pick(f, ["ad_name"]) || null,
    adsetName: pick(f, ["adset_name", "ad_set_name"]) || null,
    campaignName: pick(f, ["campaign_name"]) || null,
    formName: pick(f, ["form_name"]) || null,
    metaLeadId: pick(f, ["leadgen_id", "lead_id", "id"]) || null,
    createdTime: pick(f, ["created_time", "created_at"]) || null,
    previouslyEmailed: /^(true|1|yes)$/i.test(previously),
    businessCandidates,
    emailDomain,
  };
}
