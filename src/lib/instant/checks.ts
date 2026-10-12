// The free-ish checks run on every new lead before the email is written: Google Business Profile,
// a Google Maps rank for their trade and suburb, the website, Google Ads (Ads Transparency) and
// Instagram. Each finding becomes a Fact with a confidence. The email may only use these facts.
// About US$0.01-0.02 of DataForSEO per lead (plus ~US$0.004 when a website speed check runs).

import { dfsLive } from "./dataforseo";
import type { InstantLeadForm } from "./form";

export type Confidence = "high" | "medium" | "low";
export type FactArea = "google_profile" | "maps" | "website" | "google_ads" | "social" | "identity";

export interface Fact {
  id: string;
  area: FactArea;
  tone: "gap" | "positive" | "neutral";
  confidence: Confidence;
  text: string;
}

export interface WebsiteCheck {
  url: string;
  finalUrl: string | null;
  status: number | null;
  ok: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  telLinks: number;
  hasViewport: boolean;
  platform: string | null;
  tagIds: string[];
  googleAdsTag: "found" | "not_found" | "unknown";
  metaPixel: "found" | "not_found" | "unknown";
  instagramHandles: string[];
  facebookLinks: string[];
  // Pages built in the browser (little text in the HTML) hide headings and tags from a fetch,
  // so "missing" findings aren't reliable for them
  clientRendered: boolean;
  error?: string;
}

export interface GbpCheck {
  found: boolean;
  matchedBy: "domain" | "name" | null;
  tried: string[];
  title?: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  domain?: string | null;
  rating?: number | null;
  reviews?: number | null;
  isClaimed?: boolean | null;
  totalPhotos?: number | null;
  placeId?: string | null;
  cid?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  region?: string | null; // "Western Australia"
  zip?: string | null;
}

export interface MapsCheck {
  keyword: string;
  near: string; // the suburb the search was run from
  rank: number | null; // null = not in the results returned
  depth: number;
  top3: Array<{ title: string; rating: number | null; reviews: number | null }>;
}

export interface AdsCheck {
  domain: string;
  adsReturned: number;
  shownLast7Days: number;
  latestShown: string | null;
  advertisers: string[];
}

export interface SocialCheck {
  handle: string | null;
  url: string | null;
  followers: string | null;
  posts: string | null;
  bio: string | null; // the profile snippet Google shows, when it isn't the follower counts
  matchedBy: "website_link" | "form_name" | "name" | null;
}

export interface SpeedCheck {
  url: string;
  score: number | null; // 0-100
  lcpSeconds: number | null;
}

export interface CheckResults {
  facts: Fact[];
  businessName: string | null;
  city: string | null;
  websiteUsed: string | null; // the form's website, or the one on their Google profile
  checks: { website?: WebsiteCheck; gbp?: GbpCheck; maps?: MapsCheck; ads?: AdsCheck; social?: SocialCheck; speed?: SpeedCheck };
  costUsd: number;
  timingsMs: Record<string, number>;
  errors: string[];
}

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "direct", "about", "developer", "legal", "sharer", "share"]);
const STOP = new Set(["pty", "ltd", "limited", "the", "and", "for", "group", "co", "company", "australia", "services", "service"]);

function tokens(s: string) {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length >= 3 && !STOP.has(t));
}

// Share of a's tokens found in b (joined, so "legion13perth" matches "Legion13 Perth")
function overlap(a: string, b: string) {
  const ta = tokens(a);
  if (!ta.length) return 0;
  const bl = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ta.filter((t) => bl.includes(t)).length / ta.length;
}

// Place names and filler don't identify a business: "Legion13 Perth" is identified by "legion13"
const PLACES = new Set(["perth", "sydney", "melbourne", "brisbane", "adelaide", "hobart", "darwin", "canberra", "geelong", "newcastle", "wollongong", "gold", "coast", "sunshine", "central", "north", "south", "east", "west", "western", "eastern", "northern", "southern", "inner", "hills", "city", "cbd", "vic", "nsw", "qld", "tas", "act", "australia", "australian", "aus"]);

export function distinctiveTokens(name: string) {
  return tokens(name).filter((t) => t.length >= 4 && !PLACES.has(t));
}

// True when a listing or profile title plausibly belongs to the named business. One shared word
// isn't enough when the name has several ("Should Be Digging" is not "Digging Downunder Excavations").
function sameBusiness(name: string, title: string) {
  const joined = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const d = distinctiveTokens(name);
  if (d.length === 1) return joined.includes(d[0]);
  if (d.length > 1) return d.filter((t) => joined.includes(t)).length >= Math.ceil(d.length * 0.6);
  return overlap(name, title) >= 0.6;
}

// "Pat's Gems | Sapphire Fossicking Park" -> "Pat's Gems"
function brandFromTitle(title: string | null) {
  if (!title) return null;
  const first = title.split(/\s[|\-\u2013\u2014:\u2022]\s|\s[|]|[|]\s/)[0].trim();
  return first.length >= 3 && first.length <= 40 && !/^(home|welcome|homepage)$/i.test(first) ? first : null;
}

function hostOf(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function cleanBusinessName(s: string) {
  return s.replace(/\b(pty\.?\s*ltd\.?|pty|ltd|limited)\b/gi, "").replace(/\s+/g, " ").trim();
}

async function timed<T>(name: string, timings: Record<string, number>, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    timings[name] = Date.now() - start;
  }
}

// ---------- Website ----------

export async function checkWebsite(url: string): Promise<WebsiteCheck> {
  const base: WebsiteCheck = {
    url, finalUrl: null, status: null, ok: false, title: null, metaDescription: null, h1: [], telLinks: 0, hasViewport: false,
    platform: null, tagIds: [], googleAdsTag: "unknown", metaPixel: "unknown", instagramHandles: [], facebookLinks: [], clientRendered: false,
  };
  let html = "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    base.status = res.status;
    base.finalUrl = res.url;
    html = (await res.text()).slice(0, 3_000_000);
    base.ok = res.ok && html.length > 200;
  } catch (e) {
    base.error = e instanceof Error ? e.message : String(e);
    return base;
  }
  if (!base.ok) return base;

  const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  base.title = text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null;
  const visible = text(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " "));
  base.clientRendered = visible.length < 600;
  base.metaDescription =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
    null;
  base.h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => text(m[1])).filter(Boolean).slice(0, 3);
  base.telLinks = (html.match(/href=["']tel:/gi) || []).length;
  base.hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  base.platform =
    /wp-content|wp-includes/i.test(html) ? "WordPress" :
    /static\.wixstatic\.com|wix\.com/i.test(html) ? "Wix" :
    /squarespace/i.test(html) ? "Squarespace" :
    /cdn\.shopify\.com|Shopify\.theme/i.test(html) ? "Shopify" :
    /webflow/i.test(html) ? "Webflow" :
    /img1\.wsimg\.com|godaddy/i.test(html) ? "GoDaddy" :
    /weebly/i.test(html) ? "Weebly" : null;

  base.tagIds = [...new Set(html.match(/\b(GTM-[A-Z0-9]{4,}|GT-[A-Z0-9]{4,}|G-[A-Z0-9]{6,}|AW-\d{6,})\b/g) || [])];
  const pixelRe = /fbevents\.js|connect\.facebook\.net|fbq\(\s*['"]init|facebook[-_ ]?pixel|facebookPixel/i;
  let adsFound = base.tagIds.some((t) => t.startsWith("AW-"));
  let pixelFound = pixelRe.test(html);
  let containersOk = true;
  let containersRead = 0;
  for (const id of base.tagIds.filter((t) => t.startsWith("GTM-") || t.startsWith("GT-")).slice(0, 3)) {
    const src = id.startsWith("GTM-") ? `https://www.googletagmanager.com/gtm.js?id=${id}` : `https://www.googletagmanager.com/gtag/js?id=${id}`;
    try {
      const js = await (await fetch(src, { signal: AbortSignal.timeout(10_000) })).text();
      containersRead++;
      if (/AW-\d{6,}/.test(js)) adsFound = true;
      if (pixelRe.test(js)) pixelFound = true;
    } catch {
      containersOk = false;
    }
  }
  // "Not found" only when the site's tag container was read: scripts and site builders can add
  // tags in the browser that a page fetch never sees (legion13.com.au loads Google Analytics that
  // way, 13 Oct 2026). Otherwise it's unknown and the email says nothing about it.
  const injectsLater = base.clientRendered || ["Wix", "Shopify", "Squarespace", "GoDaddy"].includes(base.platform ?? "");
  const containerRead = containersRead > 0 && containersOk && !injectsLater;
  base.googleAdsTag = adsFound ? "found" : containerRead ? "not_found" : "unknown";
  base.metaPixel = pixelFound ? "found" : containerRead ? "not_found" : "unknown";

  base.instagramHandles = [...new Set([...html.matchAll(/instagram\.com\/([A-Za-z0-9_.]{2,30})/gi)].map((m) => m[1].replace(/\.$/, "").toLowerCase()).filter((h) => !IG_RESERVED.has(h)))].slice(0, 3);
  base.facebookLinks = [...new Set([...html.matchAll(/facebook\.com\/([A-Za-z0-9_.\-]{3,60})/gi)].map((m) => m[1]).filter((p) => !/^(sharer|plugins|tr|dialog|share|profile\.php)$/i.test(p)))].slice(0, 3);
  return base;
}

// ---------- Google Business Profile ----------

export async function checkGbp(candidates: string[], websiteHost: string | null): Promise<{ gbp: GbpCheck; cost: number }> {
  const gbp: GbpCheck = { found: false, matchedBy: null, tried: [] };
  let cost = 0;
  let nameHit: { keyword: string; item: Record<string, any> } | null = null;
  let hit: Record<string, any> | null = null;
  for (const raw of candidates.slice(0, 3)) {
    const keyword = cleanBusinessName(raw);
    if (!keyword || gbp.tried.includes(keyword)) continue;
    gbp.tried.push(keyword);
    // A Google Maps search for the name, like a customer would do. (The business-info lookup
    // returned "No Search Results" for names Maps finds easily, e.g. "Legion13 Perth".)
    const { items: all, cost: c } = await dfsLive<Record<string, any>>("/serp/google/maps/live/advanced", { keyword, location_code: 2036, language_code: "en", depth: 10 });
    cost += c;
    const items = all.filter((i) => i.type === "maps_search");
    const byDomain = websiteHost ? items.find((i) => hostOf(i.domain || i.url) === websiteHost) : undefined;
    if (byDomain) { hit = byDomain; gbp.matchedBy = "domain"; break; }
    const byName = items.slice(0, 3).find((i) => sameBusiness(keyword, String(i.title || "")));
    if (byName && !nameHit) nameHit = { keyword, item: byName };
    // Without a website to confirm against, the first name match is as good as it gets
    if (nameHit && !websiteHost) break;
  }
  if (!hit && nameHit) { hit = nameHit.item; gbp.matchedBy = "name"; }
  if (hit) {
    Object.assign(gbp, {
      found: true,
      title: String(hit.title),
      category: hit.category ?? null,
      address: hit.address ?? null,
      city: hit.address_info?.city ?? null,
      domain: hit.domain ?? null,
      rating: hit.rating?.value ?? null,
      reviews: hit.rating?.votes_count ?? null,
      isClaimed: typeof hit.is_claimed === "boolean" ? hit.is_claimed : null,
      totalPhotos: hit.total_photos ?? null,
      placeId: hit.place_id ?? null,
      cid: hit.cid != null ? String(hit.cid) : null,
      latitude: typeof hit.latitude === "number" ? hit.latitude : null,
      longitude: typeof hit.longitude === "number" ? hit.longitude : null,
      region: hit.address_info?.region ?? null,
      zip: hit.address_info?.zip ?? null,
    });
  }
  return { gbp, cost };
}

// ---------- Google Maps rank for trade + suburb ----------

export async function checkMapsRank(keyword: string, gbp: GbpCheck): Promise<{ maps: MapsCheck; cost: number } | null> {
  if (!gbp.city || !gbp.region) return null;
  const depth = 20;
  // Searched as a customer in the same suburb would. Searching from the business's exact spot
  // flatters it (Legion 13 was #1 from its own address, #3 from Cannington). A country-wide location
  // with the suburb in the keyword returns no results. Fall back to the postcode, then give up.
  const locations = [`${gbp.city},${gbp.region},Australia`, gbp.zip ? `${gbp.zip},${gbp.region},Australia` : null].filter(Boolean) as string[];
  let cost = 0;
  for (const location_name of locations) {
    let items: Record<string, any>[] = [];
    try {
      const r = await dfsLive<Record<string, any>>("/serp/google/maps/live/advanced", { keyword, location_name, language_code: "en", depth });
      items = r.items;
      cost += r.cost;
    } catch {
      continue; // DataForSEO doesn't know every suburb
    }
    const places = items.filter((i) => i.type === "maps_search");
    if (!places.length) continue; // no results means no claim either way
    const idx = places.findIndex((i) => (gbp.placeId && i.place_id === gbp.placeId) || (gbp.cid && String(i.cid) === gbp.cid));
    return {
      maps: {
        keyword,
        near: location_name.startsWith(gbp.city) ? gbp.city : `the ${gbp.zip} postcode`,
        rank: idx >= 0 ? idx + 1 : null,
        depth: places.length,
        top3: places.slice(0, 3).map((i) => ({ title: String(i.title), rating: i.rating?.value ?? null, reviews: i.rating?.votes_count ?? null })),
      },
      cost,
    };
  }
  return null;
}

// ---------- Google Ads (Ads Transparency Center) ----------

export async function checkGoogleAds(domain: string): Promise<{ ads: AdsCheck; cost: number }> {
  const { items, cost } = await dfsLive<Record<string, any>>("/serp/google/ads_search/live/advanced", { target: domain, location_name: "Australia", platform: "google_search", depth: 40 });
  const now = Date.now();
  // last_shown looks like "2026-10-07 00:00:00 +00:00"
  const toIso = (s: string) => s.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ?([+-]\d{2}:?\d{2})?$/, (_m, d, t, z) => `${d}T${t}${z ?? "Z"}`);
  const shown = items.map((i) => (i.last_shown ? Date.parse(toIso(String(i.last_shown))) : NaN)).filter((n) => !Number.isNaN(n));
  const latest = shown.length ? new Date(Math.max(...shown)) : null;
  return {
    ads: {
      domain,
      adsReturned: items.length,
      shownLast7Days: shown.filter((t) => now - t <= 7 * 86_400_000).length,
      latestShown: latest ? latest.toISOString().slice(0, 10) : null,
      advertisers: [...new Set(items.map((i) => String(i.title || "")).filter(Boolean))].slice(0, 3),
    },
    cost,
  };
}

// ---------- Instagram (from Google's index of the profile) ----------

export async function checkInstagram(names: string[], siteHandles: string[], formName: string): Promise<{ social: SocialCheck; cost: number }> {
  // site: search finds profile pages; a plain name search mostly returns posts and Facebook photos
  const primary = names.find(Boolean) ?? formName;
  const words = distinctiveTokens(primary);
  const keyword = siteHandles[0] ? `site:instagram.com ${siteHandles[0]}` : `site:instagram.com ${words.length ? words.join(" ") : cleanBusinessName(primary)}`;
  const { items, cost } = await dfsLive<Record<string, any>>("/serp/google/organic/live/advanced", { keyword, location_code: 2036, language_code: "en", depth: 10 });
  const social: SocialCheck = { handle: null, url: null, followers: null, posts: null, bio: null, matchedBy: null };
  const formStart = formName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);

  const profiles = items
    .filter((x) => x.type === "organic")
    .map((i) => {
      const m = String(i.url || "").match(/instagram\.com\/([A-Za-z0-9_.]{2,30})\/?(\?|$)/i);
      if (!m || IG_RESERVED.has(m[1].toLowerCase())) return null;
      const handle = m[1].toLowerCase();
      const text = `${i.title ?? ""} ${i.description ?? ""}`;
      const viaSite = siteHandles.includes(handle);
      // People often type their Instagram display name into the form's name field
      const viaForm = formStart.length >= 8 && text.toLowerCase().replace(/[^a-z0-9]/g, "").includes(formStart);
      const viaName = names.some((n) => n && sameBusiness(n, `${i.title ?? ""} ${handle}`));
      return { i, handle, text, rank: viaSite ? 0 : viaForm ? 1 : viaName ? 2 : 9 };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.rank < 9)
    // When the website links an account, only that account counts
    .filter((x) => !siteHandles.length || x.rank === 0)
    .sort((a, b) => a.rank - b.rank);

  const best = profiles[0];
  if (best) {
    const counts = best.text.match(/([\d.,]+\s?[KkMm]?)\s+Followers?,?\s*([\d.,]+\s?[KkMm]?)\s+Following,?\s*([\d.,]+\s?[KkMm]?)\s+Posts?/);
    Object.assign(social, {
      handle: best.handle,
      url: `https://www.instagram.com/${best.handle}/`,
      followers: counts?.[1]?.replace(/\s/g, "") ?? null,
      posts: counts?.[3]?.replace(/\s/g, "") ?? null,
      bio: counts ? null : String(best.i.description ?? "").replace(/\s+/g, " ").trim().slice(0, 140) || null,
      matchedBy: best.rank === 0 ? "website_link" : best.rank === 1 ? "form_name" : "name",
    });
  } else if (siteHandles[0]) {
    // Linked from their own website but not in Google's index: still their account
    Object.assign(social, { handle: siteHandles[0], url: `https://www.instagram.com/${siteHandles[0]}/`, matchedBy: "website_link" });
  }
  return { social, cost };
}

// ---------- Mobile speed (Lighthouse), only for website leads ----------

export async function checkSpeed(url: string): Promise<{ speed: SpeedCheck; cost: number }> {
  const { result, cost } = await dfsLive<Record<string, any>>("/on_page/lighthouse/live/json", { url, for_mobile: true, categories: ["performance"] }, 120_000);
  const r = result as Record<string, any> | null;
  const score = r?.categories?.performance?.score;
  const lcp = r?.audits?.["largest-contentful-paint"]?.numericValue;
  return {
    speed: { url, score: typeof score === "number" ? Math.round(score * 100) : null, lcpSeconds: typeof lcp === "number" ? Math.round(lcp / 100) / 10 : null },
    cost,
  };
}

// ---------- Run everything and turn results into facts ----------

export async function runChecks(form: InstantLeadForm): Promise<CheckResults> {
  const timings: Record<string, number> = {};
  const errors: string[] = [];
  const out: CheckResults = { facts: [], businessName: form.businessCandidates[0] ?? null, city: null, websiteUsed: form.website, checks: {}, costUsd: 0, timingsMs: timings, errors };
  const wantsWebsite = form.helpWith.includes("website");
  const wantsSocial = form.helpWith.includes("social_media") || form.helpWith.includes("meta_ads");

  const settle = async <T>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await timed(name, timings, fn);
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  };

  // Wave 1: the form's website (quick), then the Google profile, which can also supply a website
  const formSite = form.website ? await settle("website", () => checkWebsite(form.website!)) : undefined;
  const siteBrand = formSite?.ok ? brandFromTitle(formSite.title) : null;
  const gbpCandidates = [...form.businessCandidates.slice(0, 2), ...(siteBrand ? [siteBrand] : [])];
  const gbpRes = gbpCandidates.length ? await settle("gbp", () => checkGbp(gbpCandidates, hostOf(form.website))) : undefined;
  const gbp = gbpRes?.gbp;
  if (gbpRes) { out.checks.gbp = gbp; out.costUsd += gbpRes.cost; }
  if (gbp?.found) { out.businessName = gbp.title ?? out.businessName; out.city = gbp.city ?? null; }
  if (!out.websiteUsed && gbp?.found && gbp.domain) out.websiteUsed = `https://${gbp.domain.replace(/^www\./, "")}/`;
  const host = hostOf(out.websiteUsed);

  // Wave 2: everything that needs the profile or the website
  const mapsKeywordBase = (gbp?.category || form.trade || "").toLowerCase().trim();
  const [website, adsRes, speedRes, mapsRes] = await Promise.all([
    formSite ?? (out.websiteUsed ? settle("website", () => checkWebsite(out.websiteUsed!)) : Promise.resolve(undefined)),
    host ? settle("google_ads", () => checkGoogleAds(host)) : Promise.resolve(undefined),
    out.websiteUsed && wantsWebsite ? settle("speed", () => checkSpeed(out.websiteUsed!)) : Promise.resolve(undefined),
    gbp?.found && mapsKeywordBase ? settle("maps", () => checkMapsRank(mapsKeywordBase, gbp)) : Promise.resolve(undefined),
  ]);
  if (website) out.checks.website = website;
  if (adsRes) { out.checks.ads = adsRes.ads; out.costUsd += adsRes.cost; }
  if (speedRes) { out.checks.speed = speedRes.speed; out.costUsd += speedRes.cost; }
  if (mapsRes) { out.checks.maps = mapsRes.maps; out.costUsd += mapsRes.cost; }

  // Wave 3: Instagram, using any handle the website links to
  if (out.businessName && (wantsSocial || !gbp?.found)) {
    const socialRes = await settle("instagram", () => checkInstagram([form.businessCandidates[0], out.businessName ?? ""], website?.instagramHandles ?? [], form.name));
    if (socialRes) { out.checks.social = socialRes.social; out.costUsd += socialRes.cost; }
  }

  out.facts = buildFacts(form, out);
  return out;
}

export function buildFacts(form: InstantLeadForm, r: CheckResults): Fact[] {
  const facts: Fact[] = [];
  const add = (area: FactArea, tone: Fact["tone"], confidence: Confidence, text: string) =>
    facts.push({ id: `F${facts.length + 1}`, area, tone, confidence, text });
  const { website, gbp, maps, ads, social, speed } = r.checks;

  // Identity: the form's business vs the website and Google profile
  if (form.website && form.businessCandidates[0]) {
    const host = hostOf(form.website) ?? "";
    const nameMatchesSite = form.businessCandidates.some((c) => overlap(c, host) >= 0.5);
    if (!nameMatchesSite && gbp?.matchedBy !== "domain") {
      add("identity", "neutral", "high", `The business name on the form ("${form.businessCandidates[0]}") and the website given (${host}) don't obviously match, so it's worth confirming which business this is.`);
    }
  }

  // Google Business Profile
  if (gbp) {
    if (!gbp.found) {
      add("google_profile", "gap", "medium", `I couldn't find a Google Business Profile under "${gbp.tried.join('" or "')}" when I searched Google.`);
    } else {
      const conf: Confidence = gbp.matchedBy === "domain" ? "high" : "medium";
      add("google_profile", "neutral", conf, `Google Business Profile found: "${gbp.title}", category "${gbp.category ?? "unknown"}"${gbp.city ? `, ${gbp.city}` : ""}.`);
      if (gbp.reviews != null && gbp.rating != null) {
        if (gbp.reviews >= 20 && gbp.rating >= 4.7) add("google_profile", "positive", conf, `Strong Google reviews: ${gbp.rating} stars from ${gbp.reviews} reviews.`);
        else if (gbp.reviews < 10) add("google_profile", "gap", conf, `Only ${gbp.reviews} Google review${gbp.reviews === 1 ? "" : "s"} so far (${gbp.rating} stars).`);
        else add("google_profile", "neutral", conf, `${gbp.rating} stars from ${gbp.reviews} Google reviews.`);
      } else if (gbp.reviews == null || gbp.reviews === 0) {
        add("google_profile", "gap", conf, "No Google reviews showing on the profile yet.");
      }
      if (gbp.isClaimed === false) add("google_profile", "gap", conf, "The Google Business Profile shows as unclaimed, so anyone can suggest edits to it and the owner can't post updates or reply to reviews.");
      if (gbp.totalPhotos != null && gbp.totalPhotos < 10) add("google_profile", "gap", conf, `Only ${gbp.totalPhotos} photo${gbp.totalPhotos === 1 ? "" : "s"} on the Google profile.`);
    }
  }

  // Google Maps rank
  if (maps && gbp?.found) {
    const top = maps.top3.map((t) => `${t.title}${t.reviews != null ? ` (${t.rating ?? "?"} stars, ${t.reviews} reviews)` : ""}`).join("; ");
    const searched = `When I searched Google Maps for "${maps.keyword}" from around ${maps.near}`;
    // Maps positions move between searches minutes apart (Legion 13 showed #3, then #1), so a
    // top-3 result is stated as "in the top 3", never as an exact position
    if (maps.rank && maps.rank <= 3) add("maps", "positive", "medium", `${searched}, they were in the top 3.`);
    else if (maps.rank) add("maps", "gap", "medium", `${searched}, they came up around #${maps.rank}, below the top 3: ${top}.`);
    else add("maps", "gap", "medium", `${searched}, they weren't in the ${maps.depth} results shown. The top 3 were: ${top}.`);
  }

  // Website (the form's, or the one listed on their Google profile)
  if (r.websiteUsed && website) {
    const host = hostOf(r.websiteUsed);
    if (!form.website) add("website", "neutral", "high", `No website on the form; their Google profile lists ${host}, so that's the site checked.`);
    if (!website.ok) {
      add("website", "gap", "medium", `The website (${host}) didn't load when I checked it${website.status ? ` (it returned an error ${website.status})` : ""}.`);
    } else {
      if (website.platform) add("website", "neutral", "high", `The website is built on ${website.platform}.`);
      if (website.telLinks === 0) add("website", "gap", "medium", "There's no tap-to-call phone link on the homepage, so mobile visitors can't call with one tap.");
      if (!website.title || website.title.length < 15) add("website", "gap", "high", `The homepage title in Google is ${website.title ? `just "${website.title}"` : "missing"}.`);
      if (!website.metaDescription) add("website", "gap", "medium", "The homepage has no meta description, so Google writes its own snippet.");
      if (website.h1.length === 0 && !website.clientRendered) add("website", "gap", "medium", "The homepage has no main heading (H1).");
      if (website.metaPixel === "found") add("website", "neutral", "high", "The Meta pixel is installed on the website.");
      if (website.metaPixel === "not_found") add("website", "gap", "medium", "I couldn't see a Meta pixel on the website, which you need to measure Meta ads and show ads to people who visited the site.");
    }
  }
  if (speed?.score != null) {
    if (speed.score < 50) add("website", "gap", "medium", `On a mobile test (Google Lighthouse), the homepage scored ${speed.score}/100 for speed${speed.lcpSeconds ? ` and the main content took about ${speed.lcpSeconds} seconds to appear` : ""}.`);
    else if (speed.score >= 90) add("website", "positive", "medium", `The homepage is fast on mobile (Google Lighthouse speed score ${speed.score}/100).`);
  }

  // Google Ads
  if (ads) {
    if (ads.shownLast7Days > 0) add("google_ads", "neutral", "high", `They're running Google Ads right now: ${ads.shownLast7Days} ad${ads.shownLast7Days === 1 ? "" : "s"} shown in the last week (Google Ads Transparency Center).`);
    else if (ads.adsReturned > 0 && ads.latestShown) add("google_ads", "gap", "high", `They've run Google Ads before, but the most recent ad was last shown on ${ads.latestShown} (Google Ads Transparency Center).`);
    else add("google_ads", "neutral", "high", `No Google Ads found for ${ads.domain} in Google's Ads Transparency Center.`);
  }

  // Instagram
  if (social?.handle) {
    const conf: Confidence = social.matchedBy === "name" ? "medium" : "high";
    const counts = [social.followers ? `about ${social.followers} followers` : null, social.posts ? `${social.posts} posts` : null].filter(Boolean).join(" and ");
    add("social", "neutral", conf, `Their Instagram is @${social.handle}${counts ? `, with ${counts} (as listed in Google's results)` : ""}${social.bio ? `. Profile text in Google: "${social.bio}"` : ""}.`);
  } else if (social && r.businessName) {
    add("social", "neutral", "low", `I couldn't find an Instagram profile for "${r.businessName}" in Google's results.`);
  }
  if (website?.ok && website.instagramHandles.length === 0 && website.facebookLinks.length === 0) {
    add("social", "gap", "medium", "The website doesn't link to Instagram or Facebook.");
  }

  return facts;
}
