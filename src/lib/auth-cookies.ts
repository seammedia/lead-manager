import { cookies } from "next/headers";

const GMAIL_TOKENS_COOKIE = "gmail_tokens";
const GMAIL_EMAIL_COOKIE = "gmail_email";

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

export async function setGmailTokens(tokens: GmailTokens, email: string) {
  const cookieStore = await cookies();

  // Store tokens as encrypted JSON (in production, use proper encryption)
  cookieStore.set(GMAIL_TOKENS_COOKIE, JSON.stringify(tokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  cookieStore.set(GMAIL_EMAIL_COOKIE, email, {
    httpOnly: false, // Allow client to read email
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function getGmailTokens(): Promise<GmailTokens | null> {
  const cookieStore = await cookies();
  const tokensCookie = cookieStore.get(GMAIL_TOKENS_COOKIE);

  if (!tokensCookie?.value) {
    return null;
  }

  try {
    return JSON.parse(tokensCookie.value) as GmailTokens;
  } catch {
    return null;
  }
}

export async function getGmailEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const emailCookie = cookieStore.get(GMAIL_EMAIL_COOKIE);
  return emailCookie?.value || null;
}

export async function clearGmailTokens() {
  const cookieStore = await cookies();
  cookieStore.delete(GMAIL_TOKENS_COOKIE);
  cookieStore.delete(GMAIL_EMAIL_COOKIE);
}
