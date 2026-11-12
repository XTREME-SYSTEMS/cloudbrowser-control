import test from "node:test";
import assert from "node:assert/strict";
import {
  accessAssessment, documentKind, safeDocumentUrl,
  extractPlanManifest, discoverPlansOnPage
} from "../plan-discovery.js";

const base = "https://www.ldiline.com/projects/15527/plans/bobs-discount-furniture-melbourne-fl";

test("sanitizes signed URLs and blocks non-public/private destinations", () => {
  assert.equal(safeDocumentUrl("/projects/15527/plans?a=private-token#section", base),
    "https://www.ldiline.com/projects/15527/plans");
  for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "http://localhost/a",
    "http://127.0.0.1/a", "http://169.254.169.254/latest", "http://10.0.0.9/",
    "http://192.168.1.100/", "http://172.20.0.1/"]) {
    assert.equal(safeDocumentUrl(bad, base), null, bad);
  }
});

test("classifies finish schedules, addenda, plans, specs and bid forms", () => {
  assert.equal(documentKind("Architectural ROOM FINISH SCHEDULE.pdf"), "finish_schedule");
  assert.equal(documentKind("Addendum 02.pdf"), "addendum");
  assert.equal(documentKind("Drawing Index - FREE DOWNLOAD"), "index");
  assert.equal(documentKind("Bob's Discount Furniture Specs.zip"), "spec");
  assert.equal(documentKind("Floor Plans"), "plan");
  assert.equal(documentKind("BID FORM.docx"), "bid_form");
});

test("models registered-user planroom restrictions without assuming free access", () => {
  const r = accessAssessment("Order this section for $10.00\nThis is available for download to registered users. Log in now");
  assert.equal(r.state, "login_required");
  assert.equal(r.requires_login, true);
  assert.equal(r.paid_order_offered, true);
});

test("recognizes CAPTCHA, forbidden and public states", () => {
  assert.equal(accessAssessment("Check access", { captcha: true }).state, "challenge_handoff");
  assert.equal(accessAssessment("403 Forbidden").state, "forbidden");
  assert.equal(accessAssessment("Public Project Plans").state, "public_listing");
});

test("extracts LDI public listing links but does not claim a document download", () => {
  const x = extractPlanManifest({
    url: base,
    title: "Bob's Discount Furniture :: Plans",
    text: "Bob's Discount Furniture Melbourne\nDrawing Index - FREE DOWNLOAD\nFull Set\nRegister / Login",
    links: [
      { label: "Plans", href: base },
      { label: "Specs", href: "https://www.ldiline.com/projects/15527/specs/bobs-discount-furniture-melbourne-fl" },
      { label: "Drawing Index - FREE DOWNLOAD", href: "/projects/15527/plans/index", context: "1.5MB" },
      { label: "No script", href: "javascript:alert(1)" }
    ]
  }, { projectId: "6af5581adeb26661b7f890ec", sourceMessageId: "1a1cb292692cec76" });
  assert.equal(x.stage, "PUBLIC_INDEX_OR_METADATA");
  assert.equal(x.documents.length, 4);
  assert.equal(x.documents.find(d => d.kind === "index").access, "listing_link_only");
  assert.equal(x.downloaded_documents, 0);
  assert.equal(x.floor_scope_verified, false);
  assert.equal(x.measured_floor_sf, null);
  assert.equal(x.source_message_id, "1a1cb292692cec76");
});

test("recognizes an unlinked filename alongside file size as metadata, not a download", () => {
  const x = extractPlanManifest({
    url: base.replace("/plans/", "/specs/"),
    title: "Bob's Discount Furniture :: Specs",
    text: "Specs\nOrder this section for $10.00\nThis is available for download to registered users. Log in now\nBob's Discount Furniture Melbourne, FL Specs.zip\t161.3 KB",
    links: [{ label: "Specs", href: base.replace("/plans/", "/specs/") }]
  });
  assert.equal(x.stage, "HOLD_SOURCE");
  assert.equal(x.access.state, "login_required");
  assert.ok(x.documents.some(d => d.label.includes("Specs.zip") && d.href === null));
});

test("deduplicates links, marks external hosts and preserves bidder-specific deadlines as evidence only", () => {
  const x = extractPlanManifest({
    url: base,
    title: "Bob's Discount Furniture",
    text: "Due: 11/17/2026 11:59 PM EST\n45,369.00 SF building area\nTrades include Concrete Finishes",
    links: [
      {label:"Full Plans.zip",href:"https://www.ldiline.com/official/plans.zip?a=one"},
      {label:"Full Plans.zip",href:"https://www.ldiline.com/official/plans.zip?a=two"},
      {label:"Addendum 2",href:"https://www.otherplanroom.com/addenda/2.pdf"},
    ]
  });
  assert.equal(x.documents.length, 2);
  assert.equal(x.documents.find(d=>d.kind === "addendum").offsite, true);
  assert.ok(x.deadline_evidence[0].includes("11/17/2026"));
  assert.ok(x.trade_evidence.some(t => /Concrete Finishes/i.test(t)));
  assert.equal(x.floor_scope_verified, false);
});

test("provides browser helper without navigation, downloads, forms or network fetches", async () => {
  let calls = 0;
  const fixture = {url:base,title:"Test",text:"Drawing Index",links:[]};
  const page = { evaluate: async () => {calls++; return fixture;} };
  const out = await discoverPlansOnPage(page,{gc:"Sierra Contracting"});
  assert.equal(calls,1);
  assert.equal(out.gc,"Sierra Contracting");
  assert.equal(out.downloaded_documents,0);
});

test("does not misclassify planroom menus as documents", () => {
  const x = extractPlanManifest({
    url: base,
    title: "Planroom navigation",
    text: "Public projects\nDrawing Index - FREE DOWNLOAD\nFull Set",
    links: [
      { label: "Skip to main content", href: "#content" },
      { label: "PLAN ROOM", href: "/" },
      { label: "Plan Holders", href: "/plan-holders" },
      { label: "Plans", href: base },
      { label: "Specs", href: base.replace("/plans/", "/specs/") }
    ]
  });
  assert.equal(x.documents.some(d => d.label === "PLAN ROOM"), false);
  assert.equal(x.documents.some(d => d.label === "Plan Holders"), false);
  assert.equal(x.documents.some(d => d.label === "Skip to main content"), false);
  assert.equal(x.documents.filter(d => d.label === "Plans").length, 1);
});

test("records unlinked drawing index and full set without asserting download rights", () => {
  const x = extractPlanManifest({
    url: base, text: "Drawing Index - FREE DOWNLOAD\nFull Set",
    links: []
  });
  assert.ok(x.documents.some(d => d.label === "Drawing Index - FREE DOWNLOAD" && d.href === null && d.access === "listed_no_direct_url"));
  assert.ok(x.documents.some(d => d.label === "Full Set" && d.kind === "plan" && d.access === "listed_no_direct_url"));
  assert.equal(x.downloaded_documents, 0);
  assert.equal(x.measured_floor_sf, null);
});

test("detects access warnings from collapsed planroom link text", () => {
  const x = extractPlanManifest({
    url: base,
    title: "Plans",
    text: "Drawing Index - FREE DOWNLOAD\nFull Set",
    links: [
      { label: "Plans", href: base },
      { label: "This is available for download to registered users. Log in now", href: "https://www.ldiline.com/auth/login?redirect=https://www.ldiline.com/projects/15527/plans" }
    ]
  });
  assert.equal(x.access.state, "login_required");
  assert.equal(x.stage, "HOLD_SOURCE");
  assert.ok(x.documents.some(d => d.kind === "index"));
  assert.equal(x.downloaded_documents, 0);
});
