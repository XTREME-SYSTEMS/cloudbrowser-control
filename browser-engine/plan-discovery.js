/**
 * X1 read-only construction plan discovery.
 *
 * Extracts evidence and access conditions from the currently authorized page.
 * Does NOT follow links, submit forms, solve challenges, buy files or download.
 * The caller must enforce site policies, authentication, rate limits and tenant RLS.
 */
const FILE_EXTENSION = /\.(pdf|dwg|dxf|zip|7z|xlsx|xls|docx)(?:$|[?#])/i;
const PLAN_TERMS = /\b(plans?|drawing|blueprint|floor|finish|sheet|schedule|specification|specs?|addend(?:um|a)|bid form|construction document|architectural|division 0[39])\b/i;
const PRIVATE_HOST = /(^localhost$|\.localhost$|\.internal$|\.local$|^metadata\.google\.internal$)/i;

function normalized(value, limit = 400) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function isReservedHost(host) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST.test(h) || h === "::1" || h === "0.0.0.0" || h === "169.254.169.254") return true;
  if (h.startsWith("fc") && h.includes(":") || h.startsWith("fd") && h.includes(":") || h.startsWith("fe80:")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const parts = h.split(".").map(Number);
    const [a, b] = parts;
    return parts.some(x => x > 255) || a === 0 || a === 10 || a === 127 || a >= 224 ||
      a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 ||
      a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254;
  }
  return false;
}

/** Return safe public link for evidentiary display, stripping query tokens. */
export function safeDocumentUrl(href, baseUrl) {
  try {
    const value = new URL(href, baseUrl);
    if (!["https:", "http:"].includes(value.protocol) || isReservedHost(value.hostname)) return null;
    value.search = "";
    value.hash = "";
    value.username = "";
    value.password = "";
    return value.toString();
  } catch {
    return null;
  }
}

export function documentKind(input) {
  const s = normalized(input, 600).toLowerCase();
  if (/\b(drawing|sheet)\s*index\b/.test(s)) return "index";
  if (/\b(room\s*)?finish\s*(schedule|plan)\b/.test(s) || /\bfloor\s*finish\b/.test(s)) return "finish_schedule";
  if (/\baddend(?:um|a)\b/.test(s)) return "addendum";
  if (/\bbid\s*forms?\b|\bproposal\s*forms?\b/.test(s)) return "bid_form";
  if (/\bspec(?:ifications?)?s?\b/.test(s)) return "spec";
  if (/\bplan(?:s)?\b|\bdrawings?\b|\barchitectural\b|\bblueprints?\b/.test(s)) return "plan";
  return "unknown";
}

export function accessAssessment(text = "", indicators = {}) {
  const s = String(text).slice(0, 50000);
  const captcha = Boolean(indicators.captcha) || /(?:captcha|verify you are human|checking your browser)/i.test(s);
  const forbidden = /(?:\b403 forbidden\b|\baccess denied\b|\bunauthorized request\b)/i.test(s);
  const registered = /(?:available for download to registered users|register(?:ed)?\s+(?:users?|to download)|log in now|login required|sign in to download)/i.test(s);
  const paid = /(?:order this section for\s*\$|available for purchase|purchase (?:the )?(?:plans?|specs?|download)|buy now)/i.test(s);
  if (captcha) return { state: "challenge_handoff", requires_login: registered, paid_order_offered: paid };
  if (forbidden) return { state: "forbidden", requires_login: registered, paid_order_offered: paid };
  if (registered) return { state: "login_required", requires_login: true, paid_order_offered: paid };
  if (paid) return { state: "payment_offered", requires_login: false, paid_order_offered: true };
  return { state: "public_listing", requires_login: false, paid_order_offered: false };
}

export function extractPlanManifest(snapshot = {}, context = {}) {
  const pageUrl = safeDocumentUrl(snapshot.url, snapshot.url);
  if (!pageUrl) throw new TypeError("Expected a public HTTP(S) plan source URL");
  const pageHost = new URL(pageUrl).hostname;
  const text = String(snapshot.text || "").slice(0, 100000);
  const access = accessAssessment(text, { captcha: snapshot.captcha });
  const documents = [];
  const seen = new Set();
  const anchors = Array.isArray(snapshot.links) ? snapshot.links.slice(0, 1000) : [];

  for (const anchor of anchors) {
    const label = normalized(anchor.label || anchor.text, 240);
    const contextText = normalized(anchor.context, 320);
    const href = safeDocumentUrl(anchor.href, pageUrl);
    if (!href) continue;
    const combined = label + " " + href + " " + contextText;
    if (!PLAN_TERMS.test(combined) && !FILE_EXTENSION.test(href)) continue;
    const ext = href.match(FILE_EXTENSION)?.[1]?.toLowerCase() || null;
    const kind = documentKind(combined);
    const key = href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    documents.push({
      label: label || new URL(href).pathname.split("/").pop(),
      href,
      kind,
      extension: ext,
      // A linked listing is not proof the underlying drawings can be downloaded.
      access: ext ? "unverified_download" : "listing_link_only",
      source_excerpt: contextText.slice(0, 240),
      offsite: new URL(href).hostname !== pageHost,
      sha256: null,
      revision: null
    });
  }

  // Many planrooms expose file names as plain text, without a download href.
  const filename = /(?:^|\n)\s*([^\n\r]{2,140}\.(?:pdf|dwg|dxf|zip|7z|xlsx|xls|docx))\s*(?:\n|$)/gim;
  let match;
  while ((match = filename.exec(text)) && documents.length < 100) {
    const label = normalized(match[1], 145);
    const key = "unlinked:" + label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    documents.push({
      label, href: null, kind: documentKind(label),
      extension: label.match(FILE_EXTENSION)?.[1]?.toLowerCase() || null,
      access: "filename_only", source_excerpt: label, offsite: false,
      sha256: null, revision: null
    });
  }
  const dueLines = text.split(/\n/).map(x => normalized(x, 180))
    .filter(x => /^(?:due\s*:|bid\s*(?:due|date|deadline)\s*:|proposal\s*deadline\s*:)/i.test(x))
    .slice(0, 8);
  const tradeMentions = text.split(/\n/).map(x => normalized(x, 200))
    .filter(x => /\b(concrete finishes|polished concrete|epoxy|resinous flooring|urethane cement|floor preparation|surface prep)\b/i.test(x))
    .slice(0, 8);
  const hasPublicFileLinks = documents.some(x => x.extension && x.href);
  const stage = access.state === "public_listing"
    ? hasPublicFileLinks ? "PUBLIC_DOCUMENT_LINKS_UNVERIFIED" : "PUBLIC_INDEX_OR_METADATA"
    : access.state === "challenge_handoff" ? "HOLD_CHALLENGE"
    : "HOLD_SOURCE";
  return {
    source_url: pageUrl,
    source_title: normalized(snapshot.title, 200),
    project_id: normalized(context.projectId, 128) || null,
    gc: normalized(context.gc, 160) || null,
    source_message_id: normalized(context.sourceMessageId, 128) || null,
    inspected_at: new Date().toISOString(),
    stage,
    access,
    documents: documents.slice(0, 100),
    deadline_evidence: dueLines,
    trade_evidence: tradeMentions,
    floor_scope_verified: false,
    measured_floor_sf: null,
    downloaded_documents: 0,
    note: "Link/file discovery only. No authenticated entitlement, downloaded bytes, revision/hash, measured flooring area, or bidability is implied."
  };
}

/** Read-only Playwright page helper. No network calls beyond the existing page. */
export async function discoverPlansOnPage(page, context = {}) {
  if (!page || typeof page.evaluate !== "function") throw new TypeError("Playwright page required");
  const snapshot = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: document.body?.innerText || "",
    captcha: Boolean(document.querySelector("iframe[src*='captcha'],iframe[src*='recaptcha'],.h-captcha,.cf-turnstile")),
    links: [...document.querySelectorAll("a[href]")].slice(0, 1000).map(a => ({
      label: a.innerText || a.textContent || "",
      href: a.href,
      context: a.closest("tr,li,article")?.innerText?.slice(0, 350) ||
        a.parentElement?.innerText?.slice(0, 350) || ""
    }))
  }));
  return extractPlanManifest(snapshot, context);
}
