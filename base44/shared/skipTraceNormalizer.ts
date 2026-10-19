/**
 * Skip Trace Normalizer
 * 
 * Normalizes and deduplicates skip-trace findings across all source categories.
 * Produces clean, consistent, cross-referenced data for enrichment and reporting.
 */

// === PHONE NORMALIZATION (E.164) ===
export function normalizePhone(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  // Strip leading 1 for US numbers
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  // Reject obviously invalid patterns
  if (digits[0] === "0" || digits[0] === "1") return null;
  if (digits[3] === "0" || digits[3] === "1") return null;
  // Reject repeated/sequential patterns
  if (/^(\d)\1{9}$/.test(digits)) return null;
  return `+1${digits}`;
}

export function formatPhoneDisplay(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

// === EMAIL NORMALIZATION ===
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DISPOSABLE_DOMAINS = ["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com"];

export function normalizeEmail(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const email = raw.toLowerCase().trim().replace(/\s/g, "");
  if (!EMAIL_RE.test(email)) return null;
  const domain = email.split("@")[1];
  if (DISPOSABLE_DOMAINS.includes(domain)) return null;
  // Reject obvious role/no-reply addresses
  const local = email.split("@")[0];
  if (["noreply", "no-reply", "donotreply", "example", "test", "admin", "info"].includes(local) && local.length < 8) {
    return null;
  }
  return email;
}

// === ADDRESS NORMALIZATION ===
const STREET_SUFFIX_MAP: Record<string, string> = {
  "street": "St", "st": "St", "avenue": "Ave", "ave": "Ave", "avenue.": "Ave",
  "boulevard": "Blvd", "blvd": "Blvd", "drive": "Dr", "dr": "Dr",
  "road": "Rd", "rd": "Rd", "lane": "Ln", "ln": "Ln", "way": "Way",
  "court": "Ct", "ct": "Ct", "circle": "Cir", "cir": "Cir",
  "place": "Pl", "pl": "Pl", "trail": "Trl", "parkway": "Pkwy",
};

const DIR_MAP: Record<string, string> = {
  "north": "N", "n": "N", "south": "S", "s": "S",
  "east": "E", "e": "E", "west": "W", "w": "W",
  "northeast": "NE", "ne": "NE", "northwest": "NW", "nw": "NW",
  "southeast": "SE", "se": "SE", "southwest": "SW", "sw": "SW",
};

const STATE_MAP: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
  "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
  "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
  "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN",
  "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
  "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY", "dc": "DC", "d.c.": "DC",
};

export function normalizeAddress(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let addr = raw.trim().replace(/\s+/g, " ").replace(/[.,]+(?=\s|$)/g, "");
  if (addr.length < 8) return null;

  // Title case words, apply suffix/direction/state maps
  const words = addr.split(" ");
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (STREET_SUFFIX_MAP[w]) out.push(STREET_SUFFIX_MAP[w]);
    else if (DIR_MAP[w]) out.push(DIR_MAP[w]);
    else if (STATE_MAP[w]) out.push(STATE_MAP[w]);
    else if (w.length === 2 && /^[a-z]{2}$/.test(w) && STATE_MAP[w]) out.push(STATE_MAP[w]);
    else if (/^\d+$/.test(w)) out.push(w);
    else out.push(w.charAt(0).toUpperCase() + w.slice(1));
  }
  return out.join(" ");
}

// === NAME NORMALIZATION ===
export function normalizeName(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let name = raw.trim().replace(/\s+/g, " ");
  // Remove suffixes like Jr, Sr, III
  name = name.replace(/,?\s+(Jr|Sr|II|III|IV|V)\.?\s*$/i, "").trim();
  // Title case
  return name.split(" ").map((p) => {
    if (p.length <= 2 && /^[A-Z]+$/.test(p)) return p;
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).join(" ");
}

// === DEDUP + MERGE ===
export function dedupPhones(phones: any[]): any[] {
  const map = new Map<string, any>();
  for (const p of phones || []) {
    const norm = normalizePhone(p.number || p.phone || "");
    if (!norm) continue;
    const existing = map.get(norm);
    if (!existing) {
      map.set(norm, {
        ...p,
        number: norm,
        display: formatPhoneDisplay(norm),
        confidence: p.confidence || 50,
        sources: [p.source || p.source_url || "unknown"].filter(Boolean),
      });
    } else {
      // Merge — keep highest confidence, accumulate sources
      existing.confidence = Math.max(existing.confidence, p.confidence || 0);
      const src = p.source || p.source_url;
      if (src && !existing.sources.includes(src)) existing.sources.push(src);
      existing.sources = [...new Set(existing.sources)];
    }
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

export function dedupEmails(emails: any[]): any[] {
  const map = new Map<string, any>();
  for (const e of emails || []) {
    const norm = normalizeEmail(e.email || "");
    if (!norm) continue;
    const existing = map.get(norm);
    if (!existing) {
      map.set(norm, {
        ...e,
        email: norm,
        confidence: e.confidence || 50,
        verified: e.verified || false,
        sources: [e.source || "unknown"].filter(Boolean),
      });
    } else {
      existing.confidence = Math.max(existing.confidence, e.confidence || 0);
      existing.verified = existing.verified || e.verified || false;
      const src = e.source;
      if (src && !existing.sources.includes(src)) existing.sources.push(src);
      existing.sources = [...new Set(existing.sources)];
    }
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

export function dedupAddresses(addresses: any[]): any[] {
  const map = new Map<string, any>();
  for (const a of addresses || []) {
    const norm = normalizeAddress(a.address || "");
    if (!norm) continue;
    const key = norm.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...a,
        address: norm,
        confidence: a.confidence || 50,
        sources: [a.source || "unknown"].filter(Boolean),
      });
    } else {
      existing.confidence = Math.max(existing.confidence, a.confidence || 0);
      const src = a.source;
      if (src && !existing.sources.includes(src)) existing.sources.push(src);
      existing.sources = [...new Set(existing.sources)];
    }
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

export function dedupSocial(profiles: any[]): any[] {
  const map = new Map<string, any>();
  for (const s of profiles || []) {
    const url = (s.url || "").toLowerCase().trim();
    if (!url) continue;
    const existing = map.get(url);
    if (!existing) {
      map.set(url, { ...s, confidence: s.confidence || 50 });
    } else {
      existing.confidence = Math.max(existing.confidence, s.confidence || 0);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

export function dedupRelatives(relatives: any[]): any[] {
  const map = new Map<string, any>();
  for (const r of relatives || []) {
    const name = normalizeName(r.name || "");
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name,
        relationship: r.relationship || "associate",
        phone: r.phone || "",
        address: r.address || "",
        confidence: r.confidence || 40,
      });
    } else {
      existing.confidence = Math.max(existing.confidence, r.confidence || 0);
      if (r.phone && !existing.phone) existing.phone = r.phone;
      if (r.address && !existing.address) existing.address = r.address;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
}

// === CROSS-SOURCE CORRELATION ===
// Items confirmed by multiple independent sources get a confidence boost.
export function correlateConfidence(items: any[]): any[] {
  return items.map((item) => {
    const sourceCount = item.sources?.length || 1;
    // Each additional independent source adds confidence (diminishing returns)
    const boost = Math.min(20, (sourceCount - 1) * 8);
    return {
      ...item,
      confidence: Math.min(99, (item.confidence || 50) + boost),
      source_count: sourceCount,
      cross_verified: sourceCount >= 2,
    };
  });
}

// === FULL NORMALIZATION PIPELINE ===
export function normalizeAllResults(raw: any) {
  const phones = correlateConfidence(dedupPhones(raw.phone_numbers || raw.found_phone_numbers || []));
  const emails = correlateConfidence(dedupEmails(raw.emails || raw.found_emails || []));
  const addresses = correlateConfidence(dedupAddresses(raw.addresses || raw.found_addresses || []));
  const social = dedupSocial(raw.social_profiles || raw.found_social_profiles || []);
  const relatives = dedupRelatives(raw.relatives || raw.found_relatives || []);
  const ownerName = normalizeName(raw.owner_name || raw.found_owner_name || "");

  return {
    owner_name: ownerName || "",
    phone_numbers: phones,
    emails,
    addresses,
    social_profiles: social,
    relatives,
    sources: [...new Set(raw.sources || raw.sources_checked || [])],
    methods: [...new Set(raw.methods || raw.methods_used || [])],
  };
}