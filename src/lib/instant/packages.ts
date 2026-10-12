// Reads the live /marketing-packages page so emails never quote a stale or invented price
// (prices changed three times on 30 Sep 2026). If the page can't be parsed, the email links the
// page without prices and is held as a draft.

export const PACKAGES_URL = "https://www.seammedia.com.au/marketing-packages";

export interface LivePackage {
  name: string;
  weekly: number; // AUD, before GST
  description: string;
  includes: string[];
  notIncluded: string;
}

const PLAN_NAMES = ["Local Marketing Foundation", "Growth", "Complete Growth"];

export async function fetchLivePackages(): Promise<{ packages: LivePackage[]; fetchedAt: string }> {
  const res = await fetch(PACKAGES_URL, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Packages page returned ${res.status}`);
  const html = await res.text();
  const lines = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&").replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean);

  const packages: LivePackage[] = [];
  for (const name of PLAN_NAMES) {
    // A plan card is: name, "$140", "per week + GST", "Billed weekly", description, inclusions..., exclusions line
    const i = lines.findIndex((l, idx) => l === name && /^\$\d+$/.test(lines[idx + 1] ?? "") && /per week/i.test(lines[idx + 2] ?? ""));
    if (i < 0) continue;
    const weekly = Number(lines[i + 1].slice(1));
    const description = lines[i + 4] && !/^billed/i.test(lines[i + 4]) ? lines[i + 4] : lines[i + 3];
    const includes: string[] = [];
    let notIncluded = "";
    for (let j = i + 5; j < Math.min(lines.length, i + 25); j++) {
      const l = lines[j];
      if (/^(Start with|Choose)\b/.test(l) || PLAN_NAMES.includes(l)) break;
      if (/not included|quoted separately|Ad spend is separate/i.test(l)) { notIncluded = l; break; }
      includes.push(l);
    }
    packages.push({ name, weekly, description, includes, notIncluded });
  }
  if (packages.length !== PLAN_NAMES.length || packages.some((p) => !p.weekly || !p.includes.length)) {
    throw new Error("Couldn't read all three plans from the packages page");
  }
  return { packages, fetchedAt: new Date().toISOString() };
}
