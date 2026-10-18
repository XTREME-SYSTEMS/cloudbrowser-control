/**
 * Heir Evidence Engine
 * 
 * The core trust layer: confidence scoring, evidence chains, heir deduplication,
 * and state-specific intestacy calculation. This is what makes findings court-ready.
 */

// === EVIDENCE CHAIN ===
// Every finding gets a structured evidence record with source, access date, exhibit number.

export interface EvidenceItem {
  exhibit_number: string;
  finding_type: string; // "phone" | "email" | "address" | "relationship" | "death_record" | "property"
  value: string;
  source_name: string;
  source_url?: string;
  source_record_id?: string;
  access_date: string;
  confidence: number;
  corroborating_sources: string[];
  cross_verified: boolean;
  notes?: string;
}

let exhibitCounter = 0;

export function resetExhibitCounter() {
  exhibitCounter = 0;
}

export function nextExhibitNumber(prefix = "EX"): string {
  exhibitCounter++;
  return `${prefix}-${String(exhibitCounter).padStart(4, "0")}`;
}

export function createEvidence(
  finding_type: string,
  value: string,
  source_name: string,
  confidence: number,
  opts?: { source_url?: string; source_record_id?: string; notes?: string; corroborating_sources?: string[] }
): EvidenceItem {
  return {
    exhibit_number: nextExhibitNumber(),
    finding_type,
    value,
    source_name,
    source_url: opts?.source_url,
    source_record_id: opts?.source_record_id,
    access_date: new Date().toISOString(),
    confidence,
    corroborating_sources: opts?.corroborating_sources || [],
    cross_verified: (opts?.corroborating_sources?.length || 0) >= 1,
    notes: opts?.notes,
  };
}

// === CONFIDENCE SCORING ===
// Evidence-based, not LLM-guessed. Scores from corroboration, source reliability, and recency.

const SOURCE_RELIABILITY: Record<string, number> = {
  // Government / official records — highest
  "ssdi": 95, "death_certificate": 98, "birth_certificate": 98, "marriage_certificate": 97,
  "probate_court": 96, "census_records": 90, "vital_records": 95, "county_assessor": 92,
  "deed_records": 93, "sec_filings": 95, "uscis_genealogy": 90, "naturalization": 90,
  // Genealogy databases — high
  "ancestry": 80, "familysearch": 78, "myheritage": 75, "find_a_grave": 82,
  // Obituaries — medium-high
  "obituaries": 75, "newspaper_archives": 72, "funeral_homes": 78,
  // People search aggregators — medium
  "whitepages": 65, "spokeo": 60, "beenverified": 58, "intelius": 58, "pipl": 62,
  // Social — medium
  "facebook": 55, "linkedin": 70, "social_media": 55,
  // Breach / verification — high for existence, not for ownership
  "smtp_verified": 90, "phone_verified": 85, "haveibeenpwned": 70,
  // Historical — medium
  "city_directories": 68, "draft_cards": 75, "immigration_records": 72,
  // Default
  "unknown": 50,
};

export function getSourceReliability(source: string): number {
  const key = (source || "unknown").toLowerCase().trim();
  for (const [k, v] of Object.entries(SOURCE_RELIABILITY)) {
    if (key.includes(k)) return v;
  }
  return SOURCE_RELIABILITY.unknown;
}

export function calculateFindingConfidence(
  baseConfidence: number,
  sources: string[],
  corroboratingCount: number = 0
): number {
  // Start with source reliability (overrides LLM guess if higher)
  const maxReliability = Math.max(...sources.map(s => getSourceReliability(s)), baseConfidence);
  
  // Corroboration boost: each additional independent source adds confidence (diminishing)
  const corroborationBoost = Math.min(25, corroboratingCount * 8);
  
  // Cross-verification bonus
  const crossVerifiedBonus = corroboratingCount >= 2 ? 10 : 0;
  
  return Math.min(99, Math.round(maxReliability + corroborationBoost + crossVerifiedBonus));
}

// === HEIR DEDUPLICATION & VALIDATION ===

const HEIR_RELATIONSHIP_PRIORITY: Record<string, number> = {
  "spouse": 1, "wife": 1, "husband": 1,
  "child": 2, "son": 2, "daughter": 2,
  "parent": 3, "mother": 3, "father": 3,
  "sibling": 4, "brother": 4, "sister": 4,
  "grandchild": 5, "grandson": 5, "granddaughter": 5,
  "niece/nephew": 6, "niece": 6, "nephew": 6,
  "aunt/uncle": 7, "aunt": 7, "uncle": 7,
  "cousin": 8,
  "next_of_kin": 3,
  "family_plot_member": 9,
  "immigration_relative": 9,
  "international_relative": 9,
  "international heir": 9,
  "association_member": 10,
  "political_donor": 10,
  "deed_co_owner": 10,
  "network_central_figure": 10,
  "business_entity": 10,
  "relative": 9,
};

// Non-heir entries that should be filtered out
const NON_HEIR_PATTERNS = [
  "none available", "unknown", "n/a", "not available", "tbd",
  "llc", "inc", "corp", "company", "business", "estate of",
  "family_plot", "cemetery", "funeral",
];

export function isLikelyHeir(heir: any): boolean {
  const name = (heir.name || "").toLowerCase().trim();
  if (!name || name.length < 3) return false;
  
  // Filter non-person entries
  for (const pattern of NON_HEIR_PATTERNS) {
    if (name === pattern || name.startsWith(pattern + " ")) return false;
  }
  
  // Filter business entities (contain LLC, Inc, Corp)
  if (/\b(llc|inc|corp|company|ltd|llp|pllc)\b/i.test(name)) return false;
  
  // Filter entries that are clearly not people
  if (!/[a-z]+\s+[a-z]+/i.test(name)) return false;
  
  return true;
}

export function normalizeRelationship(rel: string): string {
  const r = (rel || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(HEIR_RELATIONSHIP_PRIORITY)) {
    if (r === key || r.includes(key)) return key.replace("/", "/");
  }
  return r || "relative";
}

export function getRelationshipPriority(rel: string): number {
  const r = (rel || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(HEIR_RELATIONSHIP_PRIORITY)) {
    if (r === key || r.includes(key)) return val;
  }
  return 10;
}

export function deduplicateHeirs(heirs: any[]): any[] {
  const map = new Map<string, any>();
  
  for (const heir of heirs || []) {
    if (!isLikelyHeir(heir)) continue;
    
    // Normalize name for dedup key
    const nameKey = (heir.name || "").toLowerCase().trim()
      .replace(/\s+/g, " ")
      .replace(/,?\s+(jr|sr|ii|iii|iv|v)\.?\s*$/i, "");
    
    if (!nameKey) continue;
    
    const existing = map.get(nameKey);
    if (!existing) {
      map.set(nameKey, {
        ...heir,
        name: heir.name,
        relationship: normalizeRelationship(heir.relationship),
        relationship_degree: getRelationshipPriority(heir.relationship),
        confidence: heir.confidence || 0,
        // Merge contact info
        phone_numbers: heir.phone_numbers || [],
        emails: heir.emails || [],
        social_profiles: heir.social_profiles || [],
      });
    } else {
      // Merge — keep the one with better relationship priority, merge contacts
      const existingPriority = getRelationshipPriority(existing.relationship);
      const newPriority = getRelationshipPriority(heir.relationship);
      
      if (newPriority < existingPriority) {
        // New heir has higher priority (lower number = closer relation)
        existing.relationship = normalizeRelationship(heir.relationship);
        existing.relationship_degree = newPriority;
        existing.inheritance_priority = heir.inheritance_priority || existing.inheritance_priority;
      }
      
      // Merge contacts
      existing.phone_numbers = [...(existing.phone_numbers || []), ...(heir.phone_numbers || [])];
      existing.emails = [...(existing.emails || []), ...(heir.emails || [])];
      existing.social_profiles = [...(existing.social_profiles || []), ...(heir.social_profiles || [])];
      
      // Keep highest confidence
      existing.confidence = Math.max(existing.confidence, heir.confidence || 0);
      
      // Merge notes
      if (heir.notes && !existing.notes?.includes(heir.notes)) {
        existing.notes = [existing.notes, heir.notes].filter(Boolean).join("; ");
      }
    }
  }
  
  // Dedup merged contacts within each heir
  return Array.from(map.values()).map(h => ({
    ...h,
    phone_numbers: dedupContacts(h.phone_numbers, "number"),
    emails: dedupContacts(h.emails, "email"),
    social_profiles: dedupSocialProfiles(h.social_profiles),
  })).sort((a, b) => {
    // Sort by relationship priority, then by confidence
    const relDiff = (a.relationship_degree || 10) - (b.relationship_degree || 10);
    if (relDiff !== 0) return relDiff;
    return (b.confidence || 0) - (a.confidence || 0);
  });
}

function dedupContacts(items: any[], keyField: string): any[] {
  const map = new Map<string, any>();
  for (const item of items || []) {
    const val = (item[keyField] || "").toString().toLowerCase().trim();
    if (!val) continue;
    const existing = map.get(val);
    if (!existing) {
      map.set(val, { ...item, sources: [item.source || "unknown"].filter(Boolean) });
    } else {
      existing.confidence = Math.max(existing.confidence || 0, item.confidence || 0);
      const src = item.source;
      if (src && !existing.sources.includes(src)) existing.sources.push(src);
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

function dedupSocialProfiles(profiles: any[]): any[] {
  const map = new Map<string, any>();
  for (const p of profiles || []) {
    const url = (p.url || "").toLowerCase().trim();
    if (!url) continue;
    if (!map.has(url)) map.set(url, p);
  }
  return Array.from(map.values());
}

// === STATE-SPECIFIC INTESTACY ENGINE ===
// Simplified intestacy priority by state category.
// Real implementation would use full state statute lookup.

export interface IntestacyRule {
  state: string;
  priority_order: string[]; // ordered list of heir classes
  spouse_share: string;
  no_spouse_distribution: string;
  notes: string;
}

// Common intestacy framework (majority of states follow this pattern)
const COMMON_INTESTACY: IntestacyRule = {
  state: "Common (Majority of States)",
  priority_order: [
    "spouse",
    "children (and descendants of deceased children)",
    "parents",
    "siblings (and descendants of deceased siblings)",
    "grandparents",
    "aunts/uncles (and descendants)",
    "cousins",
  ],
  spouse_share: "Spouse inherits 100% if no children/parents; 50% if children from another relationship; varies by state",
  no_spouse_distribution: "Children share equally; if no children, to parents; if no parents, to siblings per stirpes",
  notes: "Most states follow the Uniform Probate Code with variations. Consult state-specific statute for exact shares.",
};

// State-specific variations (simplified)
const STATE_VARIATIONS: Record<string, Partial<IntestacyRule>> = {
  "TX": { spouse_share: "Community property state: spouse keeps 1/2 community + shares separate property with children" },
  "CA": { spouse_share: "Community property state: spouse keeps 1/2 community + 1/3 separate property if 1 child, 1/2 if 2+ children" },
  "FL": { spouse_share: "Elective share state: spouse gets 30% elective share or intestate share, whichever is greater" },
  "NY": { spouse_share: "Spouse gets first $50,000 plus 1/2 if children exist; 100% if no children" },
  "PA": { spouse_share: "Spouse gets first $30,000 plus 1/2 if children exist; 100% if no children/parents" },
};

export function getIntestacyRules(state: string): IntestacyRule {
  const stateCode = (state || "").toUpperCase().trim();
  const variation = STATE_VARIATIONS[stateCode];
  return {
    ...COMMON_INTESTACY,
    state: stateCode || "Unknown",
    ...(variation || {}),
  };
}

export function calculateInheritancePriority(heir: any, state: string): string {
  const rel = (heir.relationship || "").toLowerCase();
  const rules = getIntestacyRules(state);
  
  // Map relationship to priority class
  if (rel === "spouse" || rel === "wife" || rel === "husband") return "primary";
  if (rel === "child" || rel === "son" || rel === "daughter") return "primary";
  if (rel === "parent" || rel === "mother" || rel === "father") return "secondary";
  if (rel === "sibling" || rel === "brother" || rel === "sister") return "secondary";
  if (rel === "grandchild" || rel === "grandson" || rel === "granddaughter") return "primary"; // represents deceased child
  if (rel === "niece/nephew" || rel === "niece" || rel === "nephew") return "distant"; // represents deceased sibling
  if (rel === "aunt/uncle" || rel === "aunt" || rel === "uncle") return "distant";
  if (rel === "cousin") return "distant";
  if (rel === "next_of_kin") return "secondary";
  return "distant";
}

// === DECEASED IDENTITY LOCK ===
// Gate function: returns true only if deceased identity is confirmed

export function isDeceasedIdentityConfirmed(deceasedDetails: any): { confirmed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const d = deceasedDetails || {};
  
  if (!d.confirmed) reasons.push("Death record confirmation flag is false");
  if (!d.full_name) reasons.push("Full legal name at death not established");
  if (!d.death_date && !d.birth_date) reasons.push("Neither death date nor birth date confirmed");
  
  // Need at least 2 corroborating data points
  let corroborationCount = 0;
  if (d.death_date) corroborationCount++;
  if (d.birth_date) corroborationCount++;
  if (d.last_residence) corroborationCount++;
  if (d.ssn_state_issued) corroborationCount++;
  if (d.obituary_url || d.obituary_text) corroborationCount++;
  if (d.funeral_home) corroborationCount++;
  
  if (corroborationCount < 2) reasons.push(`Only ${corroborationCount} corroborating data point(s); need at least 2`);
  
  return {
    confirmed: d.confirmed && !!d.full_name && corroborationCount >= 2,
    reasons,
  };
}

// === OVERALL CASE CONFIDENCE ===
// Evidence-based overall score, not an average of LLM guesses

export function calculateOverallConfidence(
  deceasedDetails: any,
  familyTree: any,
  heirs: any[],
  probateInfo: any,
  sourcesChecked: string[]
): number {
  let score = 0;
  let maxScore = 0;
  
  // Deceased identity (30% weight)
  maxScore += 30;
  const deceasedCheck = isDeceasedIdentityConfirmed(deceasedDetails);
  if (deceasedCheck.confirmed) score += 30;
  else if (deceasedDetails?.confirmed) score += 15;
  else if (deceasedDetails?.full_name) score += 5;
  
  // Family tree completeness (25% weight)
  maxScore += 25;
  const tree = familyTree || {};
  let treePoints = 0;
  if (tree.spouse) treePoints += 5;
  if (tree.children?.length > 0) treePoints += 5;
  if (tree.parents?.length > 0) treePoints += 5;
  if (tree.siblings?.length > 0) treePoints += 5;
  if (tree.grandchildren?.length > 0 || tree.nieces_nephews?.length > 0) treePoints += 5;
  score += Math.min(25, treePoints);
  
  // Heir contact quality (25% weight)
  maxScore += 25;
  const validHeirs = heirs.filter(h => isLikelyHeir(h));
  const heirsWithContact = validHeirs.filter(h => 
    (h.phone_numbers?.length > 0) || (h.emails?.length > 0) || h.address
  );
  if (validHeirs.length > 0) {
    score += Math.min(15, Math.round((heirsWithContact.length / validHeirs.length) * 15));
  }
  // Average heir confidence
  const avgHeirConf = validHeirs.length > 0
    ? validHeirs.reduce((sum, h) => sum + (h.confidence || 0), 0) / validHeirs.length
    : 0;
  score += Math.min(10, Math.round(avgHeirConf / 10));
  
  // Source breadth (15% weight)
  maxScore += 15;
  const sourceCount = sourcesChecked?.length || 0;
  score += Math.min(15, Math.round(sourceCount / 8));
  
  // Probate info (5% weight)
  maxScore += 5;
  if (probateInfo?.case_number) score += 3;
  if (probateInfo?.court_county) score += 2;
  
  return Math.round((score / maxScore) * 100);
}