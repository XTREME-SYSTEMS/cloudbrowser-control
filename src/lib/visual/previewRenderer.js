// Maps each visual template to a live HTML screen rendered from the brand
// mini-UI kit. All visible copy is driven by the studio config (ctx) so the
// Template Studio can rebrand/recontent every preview live. All font-sizes
// scale with --vg-font-scale. Self-contained — no external registry deps.
import { DEFAULT_CONFIG } from "./studioConfig.js";

export const GALLERY_FAMILIES = [
  {
    key: "desktop",
    label: "Desktop Archetypes",
    platform: "desktop",
    items: [
      { id: "sidebar_workspace", name: "Sidebar Workspace" },
      { id: "topnav_workspace", name: "Top-Nav Workspace" },
      { id: "data_table", name: "Data Table" },
      { id: "analytics", name: "Analytics Dashboard" },
      { id: "kanban", name: "Kanban Board" },
      { id: "email_hub", name: "Email Hub" },
      { id: "file_manager", name: "File Manager" },
      { id: "calendar", name: "Calendar Grid" },
      { id: "settings", name: "Settings Panel" },
      { id: "crm_pipeline", name: "CRM Pipeline" },
      { id: "content_editor", name: "Content Editor" },
      { id: "media_library", name: "Media Library" },
    ],
  },
  {
    key: "mobile",
    label: "Mobile Archetypes",
    platform: "mobile",
    items: [
      { id: "mobile_feed", name: "Social Feed" },
      { id: "mobile_wallet", name: "Wallet" },
      { id: "mobile_scanner", name: "QR Scanner" },
      { id: "mobile_checkout", name: "Checkout" },
      { id: "mobile_fitness", name: "Fitness Rings" },
      { id: "mobile_food_menu", name: "Food Menu" },
      { id: "mobile_ride", name: "Ride Tracking" },
      { id: "mobile_notes", name: "Notes App" },
      { id: "mobile_habits", name: "Habit Streaks" },
      { id: "mobile_chat", name: "Chat Thread" },
      { id: "mobile_profile", name: "Profile Card" },
      { id: "mobile_onboarding", name: "Onboarding Carousel" },
    ],
  },
  {
    key: "recipes",
    label: "Experience Recipes",
    platform: "recipe",
    items: [
      { id: "recipe_landing", name: "SaaS Landing" },
      { id: "recipe_pricing", name: "Pricing Table" },
      { id: "recipe_feature_grid", name: "Feature Grid" },
      { id: "recipe_testimonial", name: "Testimonial Wall" },
      { id: "recipe_faq", name: "FAQ Accordion" },
      { id: "recipe_cta_banner", name: "CTA Banner" },
      { id: "recipe_stats_band", name: "Stats Band" },
      { id: "recipe_logo_cloud", name: "Logo Cloud" },
      { id: "recipe_timeline", name: "Timeline" },
      { id: "recipe_gallery", name: "Image Gallery" },
      { id: "recipe_team", name: "Team Grid" },
      { id: "recipe_contact", name: "Contact Form" },
    ],
  },
  {
    key: "generators",
    label: "Generators",
    platform: "recipe",
    items: [
      { id: "gen_business_card", name: "Business Card" },
      { id: "gen_brochure", name: "Tri-Fold Brochure" },
      { id: "gen_video_card", name: "Video Generator" },
      { id: "gen_invoice", name: "Invoice" },
      { id: "gen_resume", name: "Resume" },
      { id: "gen_certificate", name: "Certificate" },
      { id: "gen_poster", name: "Event Poster" },
      { id: "gen_social_post", name: "Social Post" },
      { id: "gen_newsletter", name: "Newsletter" },
      { id: "gen_qr_card", name: "QR Code Card" },
      { id: "gen_menu_card", name: "Restaurant Menu" },
      { id: "gen_ticket", name: "Event Ticket" },
      { id: "gen_real_estate", name: "Real Estate Listing" },
      { id: "gen_logo_studio", name: "Logo Studio" },
    ],
  },
];

const FS = (n) => `font-size:calc(${n}px * var(--vg-font-scale,1))`;

const ctxd = (config) => ({ ...DEFAULT_CONFIG, ...config });

const logo = (ctx) => {
  if (ctx.logoImage) return `<span class="logo"><img src="${ctx.logoImage}" alt="" style="height:16px;width:auto;border-radius:4px;vertical-align:middle" /></span>`;
  const parts = String(ctx.logoText || "CloudBrowser").trim().split(/\s+/);
  if (parts.length < 2) return `<span class="logo">${parts[0] || ""}</span>`;
  const last = parts.pop();
  return `<span class="logo">${parts.join(" ")} <b>${last}</b></span>`;
};

const nav = (ctx, active, tabs = ["Dashboard", "Projects", "Reports"]) =>
  `<div class="vg-nav">${logo(ctx)}${tabs.map((t) => `<span class="vg-tab ${t === active ? "on" : ""}">${t}</span>`).join("")}<div style="flex:1"></div><span class="vg-avatar"></span></div>`;

const phoneNav = (ctx) =>
  `<div class="vg-nav" style="justify-content:space-between">${logo(ctx)}<span class="vg-avatar"></span></div>`;

const tabbar = (tabs, active = 0) =>
  `<div class="vg-tabbar">${tabs.map((t, i) => `<div class="t ${i === active ? "on" : ""}"><div class="d"></div><span>${t}</span></div>`).join("")}</div>`;

const feedItem = (ttl, meta, w = 80) =>
  `<div class="item"><div class="thumb"></div><div class="body"><div class="ttl">${ttl}</div><div class="meta">${meta}</div><div class="ln" style="width:${w}%"></div></div></div>`;

/* ---------- DESKTOP layouts ---------- */
function sidebarWorkspace(ctx) {
  return (
    nav(ctx, "Dashboard") +
    `<div style="flex:1;display:flex;min-height:0">
      <div class="vg-side"><div class="i on">▦</div><div class="i">▤</div><div class="i">◍</div><div class="i">◷</div><div class="i">⚙</div></div>
      <div class="vg-scroll" style="flex:1;padding:12px;overflow:auto">
        <div class="vg-row vg-between" style="margin-bottom:10px"><div class="vg-col"><div style="${FS(14)};font-weight:900">${ctx.heading}</div><div class="vg-muted" style="${FS(9)}">${ctx.subtitle}</div></div><button class="vg-btn pri">+ New</button></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
          <div class="vg-kpi"><div class="v">1,284</div><div class="l">Active</div></div>
          <div class="vg-kpi"><div class="v">$48.2k</div><div class="l">Revenue</div></div>
          <div class="vg-kpi"><div class="v">96%</div><div class="l">Uptime</div></div>
        </div>
        <div class="vg-card"><div style="${FS(10)};font-weight:700;margin-bottom:6px">Recent activity</div><div class="vg-feed">${feedItem(ctx.brandName + " updated", "2h ago · Sarah")}${feedItem("New lead captured", "5h ago · Auto", 60)}</div></div>
      </div>
    </div>`
  );
}

function topnavWorkspace(ctx) {
  const cards = [
    ["Sprint 14", "12 tasks · 3 done", 40],
    ["Onboarding", "8 tasks · 6 done", 75],
    ["Q4 Campaign", "5 tasks · 1 done", 20],
    [ctx.brandName, "6 tasks · 4 done", 66],
  ];
  return (
    nav(ctx, "Overview", ["Overview", "Objects", "Reports", "Settings"]) +
    `<div class="vg-scroll" style="flex:1;padding:12px;overflow:auto">
      <div class="vg-row vg-between" style="margin-bottom:10px"><div class="vg-col"><div style="${FS(14)};font-weight:900">${ctx.heading}</div><div class="vg-muted" style="${FS(9)}">${ctx.subtitle}</div></div><button class="vg-btn pri">+ Create</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${cards.map((c) => `<div class="vg-card"><div style="${FS(10)};font-weight:700">${c[0]}</div><div class="vg-muted" style="${FS(9)};margin-top:3px">${c[1]}</div><div class="vg-bar" style="margin-top:9px"><i style="width:${c[2]}%"></i></div></div>`).join("")}
      </div>
    </div>`
  );
}

function dataTable(ctx) {
  const rows = [
    [ctx.brandName, "Sarah K.", "Active", "$12,400"],
    ["Northwind Co.", "Daniel R.", "Pending", "$3,200"],
    ["Blue Ocean LLC", "Maya P.", "Active", "$8,750"],
    ["Vertex Labs", "Sarah K.", "Won", "$21,000"],
    ["Harbor Group", "Daniel R.", "Pending", "$5,600"],
    ["Lumen Studio", "Maya P.", "Active", "$9,300"],
  ];
  const pill = (s) => `<span class="pill ${s === "Won" || s === "Active" ? "" : "soft"}">${s}</span>`;
  return (
    nav(ctx, "Records", ["Records", "People", "Settings"]) +
    `<div style="flex:1;display:flex;flex-direction:column;min-height:0">
      <div class="vg-row vg-gap2" style="padding:8px 12px;border-bottom:1px solid var(--brand-border);flex:none">
        <span class="vg-chip">Filter: Active</span><span class="vg-chip soft">Type</span><div style="flex:1"></div><button class="vg-btn out">Export</button>
      </div>
      <div class="vg-table vg-scroll" style="flex:1;overflow:auto">
        <div class="h"><span>Name</span><span>Owner</span><span>Status</span><span>Value</span></div>
        ${rows.map((r) => `<div class="r"><span>${r[0]}</span><span class="vg-muted">${r[1]}</span><span>${pill(r[2])}</span><span>${r[3]}</span></div>`).join("")}
      </div>
    </div>`
  );
}

function analytics(ctx) {
  const bars = [38, 52, 44, 61, 55, 72, 68, 80, 74, 88, 82, 95].map((h) => `<i style="height:${h}%"></i>`).join("");
  return (
    nav(ctx, "Analytics", ["Overview", "Drilldown", "Export"]) +
    `<div class="vg-scroll" style="flex:1;padding:12px;overflow:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div class="vg-kpi"><div class="v">$48.2k</div><div class="l">Revenue</div></div>
        <div class="vg-kpi"><div class="v">1,284</div><div class="l">Visitors</div></div>
        <div class="vg-kpi"><div class="v">3.9%</div><div class="l">Convert</div></div>
        <div class="vg-kpi"><div class="v">62</div><div class="l">Leads</div></div>
      </div>
      <div class="vg-card"><div style="${FS(10)};font-weight:700;margin-bottom:8px">${ctx.heading}</div><div class="vg-chart">${bars}</div></div>
    </div>`
  );
}

function kanban(ctx) {
  const cols = [
    ["Backlog", 5, ["Design review", "API spec", "Q4 plan"]],
    ["In Progress", 3, ["Auth flow", "Dashboard"]],
    ["Review", 2, ["Onboarding"]],
    ["Done", 8, ["Launch", "SEO audit"]],
  ];
  return (
    nav(ctx, "Board", ["Board", "List", "Reports"]) +
    `<div style="flex:1;min-height:0"><div class="vg-kanban">${cols.map((c) => `<div class="col"><div class="head"><span>${c[0]}</span><span>${c[1]}</span></div>${c[2].map((t) => `<div class="card"><div class="t">${t}</div><div class="m">Due Fri</div><span class="tag">P1</span></div>`).join("")}</div>`).join("")}</div></div>`
  );
}

function emailHub(ctx) {
  const folders = ["Inbox", "Sent", "Drafts", "Archive", "Spam"];
  const msgs = [["Sarah K.", "Re: Q4 plan", "10:24"], ["Daniel R.", "Invoice #441", "9:02"], ["Maya P.", "Design review", "Yest."], ["System", "Weekly digest", "Mon"]];
  return (
    nav(ctx, "Inbox", ["Mail", "Calendar", "Contacts"]) +
    `<div style="flex:1;display:flex;min-height:0">
      <div class="vg-side" style="width:46px;padding:8px 0;gap:6px">${folders.map((f, i) => `<div class="i ${i === 0 ? "on" : ""}" title="${f}">${f[0]}</div>`).join("")}</div>
      <div style="flex:1;min-width:0;border-right:1px solid var(--brand-border)" class="vg-scroll">
        ${msgs.map((m, i) => `<div style="display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-bottom:1px solid var(--brand-border);${i === 0 ? "background:var(--brand-muted)" : ""}"><span style="${FS(10)};font-weight:700">${m[0]}</span><span style="${FS(9)}">${m[1]}</span><span class="vg-muted" style="${FS(8)}">${m[2]}</span></div>`).join("")}
      </div>
      <div style="flex:1.5;min-width:0;padding:12px" class="vg-scroll">
        <div style="${FS(12)};font-weight:900">Re: Q4 plan</div>
        <div class="vg-muted" style="${FS(9)};margin-top:2px">Sarah K. · 10:24</div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">${Array.from({length:3},(_,i)=>`<div style="height:6px;border-radius:9999px;background:var(--brand-muted);width:${58+((i*23)%38)}%"></div>`).join("")}</div>
        <button class="vg-btn pri" style="margin-top:12px">Reply</button>
      </div>
    </div>`
  );
}

function fileManager(ctx) {
  const folders = ["All", "Images", "Docs", "Videos", "Shared"];
  const files = [["Report-Q4.pdf","pdf"],["logo-final.png","img"],["roadmap.docx","doc"],["demo.mp4","vid"],["invoice-441.pdf","pdf"],["team.jpg","img"],["spec.xlsx","xls"],["notes.md","doc"]];
  const ic = (k) => ({ pdf: "▤", img: "◳", doc: "▤", vid: "▶", xls: "▦" }[k] || "▤");
  return (
    nav(ctx, "Files", ["Files", "Recent", "Shared"]) +
    `<div style="flex:1;display:flex;min-height:0">
      <div class="vg-side" style="width:46px;padding:8px 0;gap:6px">${folders.map((f, i) => `<div class="i ${i === 0 ? "on" : ""}" title="${f}">${f[0]}</div>`).join("")}</div>
      <div class="vg-scroll" style="flex:1;padding:12px;overflow:auto">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
          ${files.map((f) => `<div class="vg-card" style="text-align:center;padding:14px 8px"><div style="${FS(20)}">${ic(f[1])}</div><div style="${FS(9)};font-weight:700;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f[0]}</div></div>`).join("")}
        </div>
      </div>
    </div>`
  );
}

function calendarGrid(ctx) {
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const cells = Array.from({length:35},(_,i)=>({d:(i%31)+1,events:i%7===2?2:i%7===5?1:0}));
  return (
    nav(ctx, "Calendar", ["Month","Week","Day"]) +
    `<div class="vg-scroll" style="flex:1;padding:12px;overflow:auto">
      <div class="vg-row vg-between" style="margin-bottom:10px"><div style="${FS(13)};font-weight:900">October 2026</div><div class="vg-row vg-gap2"><button class="vg-btn out">‹</button><button class="vg-btn out">›</button></div></div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${days.map(d=>`<div style="${FS(8)};font-weight:700;color:var(--brand-muted-foreground);text-align:center;text-transform:uppercase">${d}</div>`).join("")}${cells.map(c=>`<div style="min-height:48px;border:1px solid var(--brand-border);border-radius:6px;padding:3px;background:var(--brand-surface)"><div style="${FS(8)};font-weight:700;${c.d===5?"color:var(--brand-primary)":""}">${c.d}</div>${Array.from({length:c.events},(_,e)=>`<div style="height:4px;border-radius:9999px;background:${e===0?"var(--brand-primary)":"var(--brand-gold-deep)"};margin-top:3px"></div>`).join("")}</div>`).join("")}</div>
    </div>`
  );
}

function settingsPanel(ctx) {
  const sections = [["Account","Email, password, profile"],["Notifications","Email, push, in-app"],["Billing","Plan, invoices, usage"],["Security","2FA, sessions, keys"]];
  const toggles = [true,false,true,false];
  return (
    nav(ctx, "Settings", ["General","Security","Billing"]) +
    `<div class="vg-scroll" style="flex:1;padding:12px;overflow:auto">
      <div style="${FS(13)};font-weight:900;margin-bottom:10px">Settings</div>
      ${sections.map((s,i)=>`<div class="vg-card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="flex:1"><div style="${FS(10)};font-weight:700">${s[0]}</div><div class="vg-muted" style="${FS(8)}">${s[1]}</div></div><div style="width:32px;height:18px;border-radius:9999px;background:${toggles[i]?"var(--brand-primary)":"var(--brand-muted)"};position:relative"><div style="position:absolute;top:2px;left:${toggles[i]?"16px":"2px"};width:14px;height:14px;border-radius:9999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)"></div></div></div>`).join("")}
    </div>`
  );
}

function crmPipeline(ctx) {
  const stages = [["Lead",4],["Qualified",3],["Proposal",2],["Negotiation",1],["Won",2]];
  const vals = ["$2.4k","$8.1k","$15k","$32k","$48k"];
  return (
    nav(ctx, "Pipeline", ["Pipeline","Deals","Reports"]) +
    `<div class="vg-scroll" style="flex:1;padding:12px;overflow:auto">
      <div class="vg-row vg-between" style="margin-bottom:10px"><div style="${FS(13)};font-weight:900">Sales Pipeline</div><span class="vg-chip">$105.5k total</span></div>
      <div style="display:flex;gap:6px">${stages.map((s,i)=>`<div style="flex:1;border:1px solid var(--brand-border);border-radius:10px;padding:8px;background:var(--brand-surface)"><div style="${FS(8)};font-weight:700;color:var(--brand-muted-foreground);text-transform:uppercase">${s[0]}</div><div style="${FS(16)};font-weight:900;margin-top:4px">${s[1]}</div><div style="${FS(9)};color:var(--brand-primary);font-weight:700">${vals[i]}</div></div>`).join("")}</div>
    </div>`
  );
}

function contentEditor(ctx) {
  return (
    nav(ctx, "Editor", ["Write","Preview","Publish"]) +
    `<div style="flex:1;display:flex;min-height:0">
      <div class="vg-scroll" style="flex:1;padding:16px;overflow:auto">
        <div style="${FS(16)};font-weight:900;margin-bottom:4px">${ctx.heading}</div>
        <div class="vg-muted" style="${FS(9)};margin-bottom:14px">Draft · auto-saved 2m ago</div>
        <div style="display:flex;flex-direction:column;gap:6px">${Array.from({length:6},(_,i)=>`<div style="height:7px;border-radius:9999px;background:var(--brand-muted);width:${i===0?"100%":65+((i*17)%30)}%"></div>`).join("")}</div>
        <div style="margin-top:12px;display:flex;gap:6px"><button class="vg-btn pri">Publish</button><button class="vg-btn out">Save draft</button></div>
      </div>
      <div style="width:120px;border-left:1px solid var(--brand-border);padding:8px;flex:none" class="vg-scroll">
        <div style="${FS(8)};font-weight:700;color:var(--brand-muted-foreground);text-transform:uppercase;margin-bottom:6px">Outline</div>
        ${["Intro","Problem","Solution","Pricing","FAQ"].map((h,i)=>`<div style="${FS(9)};padding:4px 6px;border-radius:5px;${i===1?"background:var(--brand-primary);color:var(--brand-on-primary);font-weight:700":""}">${h}</div>`).join("")}
      </div>
    </div>`
  );
}

function mediaLibrary(ctx) {
  const items = Array.from({length:8},(_,i)=>i);
  return (
    nav(ctx, "Media", ["Library","Uploads","Collections"]) +
    `<div class="vg-scroll" style="flex:1;padding:12px;overflow:auto">
      <div class="vg-row vg-between" style="margin-bottom:10px"><div style="${FS(13)};font-weight:900">Media Library</div><button class="vg-btn pri">+ Upload</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
        ${items.map(i=>`<div style="aspect-ratio:1;border-radius:10px;border:1px solid var(--brand-border);background:linear-gradient(${135+i*15}deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));position:relative"><div style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.5);color:#fff;border-radius:4px;padding:1px 5px;font-size:calc(7px * var(--vg-font-scale,1));font-weight:700">${i+1}</div></div>`).join("")}
      </div>
    </div>`
  );
}

/* ---------- MOBILE layouts ---------- */
function mobileFeed(ctx) {
  return (
    phoneNav(ctx) +
    `<div class="vg-scroll" style="flex:1;overflow:auto">
      ${feedItem(ctx.brandName + " shipped v2", "2h · 1.2k likes", 90)}${feedItem("New feature: AI agents", "5h · 890 likes", 70)}${feedItem("Quarterly report", "1d · 412 likes", 55)}${feedItem("Team offsite recap", "2d · 650 likes", 80)}
    </div>` + tabbar(["Home","Search","Post","Profile"], 0)
  );
}

function mobileWallet(ctx) {
  return (
    phoneNav(ctx) +
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px">
      <div style="background:linear-gradient(135deg,var(--brand-secondary),var(--brand-primary));border-radius:14px;padding:14px;color:#fff">
        <div style="${FS(9)};opacity:.8">Total Balance</div>
        <div style="${FS(22)};font-weight:900;margin-top:2px">$12,840.50</div>
        <div class="vg-row vg-gap2" style="margin-top:10px"><span style="background:#ffffff26;padding:3px 8px;border-radius:9999px;font-size:calc(8px * var(--vg-font-scale,1))">•••• 4242</span></div>
      </div>
      <div style="${FS(10)};font-weight:700;margin-top:12px;margin-bottom:6px">Transactions</div>
      ${[["Spotify","-$9.99"],["Salary","+$4,200"],["Coffee","-$4.50"],["Rent","-$1,200"]].map(t=>`<div class="vg-row vg-between" style="padding:8px 0;border-bottom:1px solid var(--brand-border)"><div class="vg-row vg-gap2"><div class="vg-avatar" style="width:26px;height:26px"></div><span style="${FS(10)};font-weight:600">${t[0]}</span></div><span style="${FS(10)};font-weight:700;color:${t[1].startsWith("+")?"var(--brand-primary)":"var(--brand-text)"}">${t[1]}</span></div>`).join("")}
    </div>` + tabbar(["Home","Cards","Send","Me"], 0)
  );
}

function mobileScanner(ctx) {
  return (
    `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#0a0a0a;color:#fff;padding:20px">
      <div style="width:200px;height:200px;border:2px solid #ffffff44;border-radius:16px;position:relative">
        <div style="position:absolute;left:14px;right:14px;top:50%;height:2px;background:linear-gradient(90deg,transparent,var(--brand-primary),transparent);box-shadow:0 0 12px var(--brand-primary)"></div>
        <div style="position:absolute;top:14px;left:14px;width:24px;height:24px;border-top:3px solid var(--brand-primary);border-left:3px solid var(--brand-primary);border-radius:6px 0 0 0"></div>
        <div style="position:absolute;top:14px;right:14px;width:24px;height:24px;border-top:3px solid var(--brand-primary);border-right:3px solid var(--brand-primary);border-radius:0 6px 0 0"></div>
        <div style="position:absolute;bottom:14px;left:14px;width:24px;height:24px;border-bottom:3px solid var(--brand-primary);border-left:3px solid var(--brand-primary);border-radius:0 0 0 6px"></div>
        <div style="position:absolute;bottom:14px;right:14px;width:24px;height:24px;border-bottom:3px solid var(--brand-primary);border-right:3px solid var(--brand-primary);border-radius:0 0 6px 0"></div>
      </div>
      <div style="${FS(11)};margin-top:18px;opacity:.85">Align QR within frame</div>
    </div>` + tabbar(["Scan","History","Profile"], 0)
  );
}

function mobileCheckout(ctx) {
  const items = [["Pro plan","$49.00"],["Add-on seats (3)","$18.00"],["Tax","$5.34"]];
  return (
    phoneNav(ctx) +
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px">
      <div style="${FS(15)};font-weight:900">Checkout</div><div class="vg-muted" style="${FS(9)};margin-top:2px">Order summary</div>
      <div class="vg-card" style="margin-top:10px">${items.map((it) => `<div class="vg-row vg-between" style="margin-bottom:6px"><span style="${FS(10)}">${it[0]}</span><span style="${FS(10)};font-weight:700">${it[1]}</span></div>`).join("")}<div style="border-top:1px solid var(--brand-border);margin-top:6px;padding-top:6px" class="vg-row vg-between"><span style="${FS(10)};font-weight:700">Total</span><span style="${FS(12)};font-weight:900;color:var(--brand-primary)">$72.34</span></div></div>
      <div style="${FS(10)};font-weight:700;margin-top:12px;margin-bottom:6px">Payment</div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--brand-border);border-radius:10px;background:var(--brand-muted)"><div style="width:28px;height:18px;border-radius:4px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary))"></div><span style="${FS(10)};font-weight:700">•••• 4242</span></div>
    </div>` +
    `<div style="padding:12px;border-top:1px solid var(--brand-border)"><button class="vg-btn pri" style="width:100%;padding:11px">Pay $72.34</button></div>`
  );
}

function mobileFitness(ctx) {
  const ring = (p, color) => `conic-gradient(${color} ${p * 360}deg, transparent 0)`;
  return (
    phoneNav(ctx) +
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px">
      <div style="${FS(15)};font-weight:900">Today</div><div class="vg-muted" style="${FS(9)}">Activity</div>
      <div style="display:flex;justify-content:center;margin:14px 0"><div style="position:relative;width:130px;height:130px"><div style="position:absolute;inset:0;border-radius:9999px;background:${ring(0.82, "var(--brand-primary)")}"></div><div style="position:absolute;inset:14px;border-radius:9999px;background:${ring(0.6, "var(--brand-gold-bright)")}"></div><div style="position:absolute;inset:28px;border-radius:9999px;background:${ring(0.45, "var(--brand-gold-deep)")}"></div><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="${FS(18)};font-weight:900">82%</div><div class="vg-muted" style="${FS(8)}">of goals</div></div></div></div>
      <div class="vg-tiles"><div class="tile"><div class="ic">↑</div><div class="v">8,420</div><div class="l">Steps</div></div><div class="tile"><div class="ic">♥</div><div class="v">142</div><div class="l">BPM</div></div><div class="tile"><div class="ic">◷</div><div class="v">48m</div><div class="l">Active</div></div><div class="tile"><div class="ic">★</div><div class="v">4.9</div><div class="l">Streak</div></div></div>
    </div>` + tabbar(["Today","History","Me"], 0)
  );
}

function mobileFoodMenu(ctx) {
  const cats = ["Pizza","Burgers","Sides","Drinks"];
  const items = [["Margherita","$12"],["Pepperoni","$14"],["Veggie Supreme","$15"],["BBQ Chicken","$16"]];
  return (
    phoneNav(ctx) +
    `<div style="display:flex;gap:6px;padding:8px 12px;overflow:auto;border-bottom:1px solid var(--brand-border);flex:none">${cats.map((c, i) => `<span class="vg-chip ${i === 0 ? "" : "soft"}">${c}</span>`).join("")}</div>
    <div class="vg-scroll" style="flex:1;overflow:auto;padding:10px">
      ${items.map((it) => `<div class="vg-card" style="display:flex;align-items:center;gap:9px;margin-bottom:8px"><div style="width:42px;height:42px;border-radius:9px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));flex:none"></div><div style="flex:1"><div style="${FS(11)};font-weight:700">${it[0]}</div><div class="vg-muted" style="${FS(9)}">Cheesy · 12"</div></div><div style="${FS(11)};font-weight:900;color:var(--brand-primary)">${it[1]}</div><button class="vg-btn pri" style="padding:5px 9px">+</button></div>`).join("")}
    </div>` +
    `<div class="vg-row vg-between" style="padding:12px;border-top:1px solid var(--brand-border)"><div><span style="${FS(10)};font-weight:700">2 items</span><div style="${FS(13)};font-weight:900">$26.00</div></div><button class="vg-btn pri">View cart</button></div>`
  );
}

function mobileRide(ctx) {
  return (
    `<div style="flex:1;position:relative;background:linear-gradient(135deg,var(--brand-background),var(--brand-muted));overflow:hidden">
      <div style="position:absolute;inset:0;background-image:linear-gradient(var(--brand-border) 1px,transparent 1px),linear-gradient(90deg,var(--brand-border) 1px,transparent 1px);background-size:28px 28px;opacity:.6"></div>
      <div style="position:absolute;left:30%;top:30%;width:12px;height:12px;border-radius:9999px;background:var(--brand-primary);box-shadow:0 0 0 6px var(--vg-chip-bg)"></div>
      <div style="position:absolute;right:25%;bottom:35%;width:12px;height:12px;border-radius:9999px;background:var(--brand-gold-deep)"></div>
      <svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M30,30 Q50,20 75,65" stroke="var(--brand-primary)" stroke-width="1.5" fill="none" stroke-dasharray="3,2"/></svg>
    </div>` +
    `<div style="padding:14px;border-top:1px solid var(--brand-border);background:var(--brand-surface)">
      <div style="width:40px;height:4px;background:var(--brand-border);border-radius:9999px;margin:0 auto 10px"></div>
      <div class="vg-row vg-between"><div><div style="${FS(13)};font-weight:900">3 min away</div><div class="vg-muted" style="${FS(9)}">Sarah · Toyota Camry · 4XK 921</div></div><div style="${FS(16)};font-weight:900;color:var(--brand-primary)">$8.40</div></div>
      <button class="vg-btn pri" style="width:100%;margin-top:10px;padding:11px">Cancel ride</button>
    </div>`
  );
}

function mobileNotes(ctx) {
  const notes = [["Q4 strategy","Bullet points and OKRs…","2h"],["Meeting notes","Action items from sync…","Yest."],["Ideas","New onboarding flow…","Mon"],["Reading list","Books and articles…","Last wk"]];
  return (
    phoneNav(ctx) +
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:10px">
      <div style="display:flex;align-items:center;gap:6px;padding:7px 11px;border:1px solid var(--brand-border);border-radius:9999px;background:var(--brand-muted);margin-bottom:10px"><span style="${FS(11)}">🔍</span><span class="vg-muted" style="${FS(10)}">Search notes…</span></div>
      ${notes.map((n) => `<div class="vg-card" style="margin-bottom:8px"><div style="${FS(11)};font-weight:700">${n[0]}</div><div class="vg-muted" style="${FS(9)};margin-top:3px">${n[1]}</div><div class="vg-muted" style="${FS(8)};margin-top:6px">${n[2]}</div></div>`).join("")}
    </div>` +
    `<div class="vg-fab">+</div>` + tabbar(["Notes","Shared","Me"], 0)
  );
}

function mobileHabits(ctx) {
  const habits = [["Morning run","12 day streak"],["Read 20 min","5 day streak"],["No sugar","3 day streak"],["Meditate","21 day streak"]];
  const cells = Array.from({ length: 28 }, (_, i) => (i % 7 < 3 ? 1 : 0));
  return (
    phoneNav(ctx) +
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px">
      <div style="${FS(15)};font-weight:900">Habits</div><div class="vg-muted" style="${FS(9)}">4 active · 12 day best streak</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:12px 0">${cells.map((c) => `<div style="aspect-ratio:1;border-radius:5px;background:${c ? "var(--brand-primary)" : "var(--brand-muted)"};opacity:${c ? 0.9 : 0.5}"></div>`).join("")}</div>
      ${habits.map((h) => `<div class="vg-card" style="display:flex;align-items:center;gap:9px;margin-bottom:7px"><div style="width:32px;height:32px;border-radius:8px;background:var(--vg-chip-bg);color:var(--brand-primary);display:flex;align-items:center;justify-content:center"><span style="${FS(13)}">🔥</span></div><div style="flex:1"><div style="${FS(10)};font-weight:700">${h[0]}</div><div class="vg-muted" style="${FS(8)}">${h[1]}</div></div><div style="width:28px;height:16px;border-radius:9999px;background:var(--brand-primary)"></div></div>`).join("")}
    </div>` + tabbar(["Habits","Stats","Me"], 0)
  );
}

function mobileChat(ctx) {
  const msgs = [["them","Hey! Are we still on for 3pm?"],["me","Yes! See you then 👍"],["them","Perfect. I'll bring the docs."],["me","Great, thanks!"]];
  return (
    phoneNav(ctx) +
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:6px">
      ${msgs.map(m=>`<div style="align-self:${m[0]==="me"?"flex-end":"flex-start"};max-width:72%;padding:7px 11px;border-radius:12px;background:${m[0]==="me"?"var(--brand-primary)":"var(--brand-muted)"};color:${m[0]==="me"?"var(--brand-on-primary)":"var(--brand-text)"};font-size:calc(10px * var(--vg-font-scale,1));font-weight:600">${m[1]}</div>`).join("")}
    </div>` +
    `<div style="padding:8px 10px;border-top:1px solid var(--brand-border);display:flex;gap:6px;flex:none"><div style="flex:1;padding:8px 12px;border:1px solid var(--brand-border);border-radius:9999px;background:var(--brand-muted);font-size:calc(10px * var(--vg-font-scale,1));color:var(--brand-muted-foreground)">Message…</div><button class="vg-btn pri" style="padding:8px 12px">→</button></div>`
  );
}

function mobileProfile(ctx) {
  return (
    phoneNav(ctx) +
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:14px">
        <div style="width:64px;height:64px;border-radius:9999px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));box-shadow:inset 0 2px #fff6"></div>
        <div style="${FS(14)};font-weight:900">${ctx.brandName}</div><div class="vg-muted" style="${FS(9)}">Pro member · Joined 2024</div>
      </div>
      <div class="vg-tiles"><div class="tile"><div class="v">128</div><div class="l">Posts</div></div><div class="tile"><div class="v">2.4k</div><div class="l">Followers</div></div><div class="tile"><div class="v">42</div><div class="l">Following</div></div><div class="tile"><div class="v">4.9</div><div class="l">Rating</div></div></div>
      <button class="vg-btn pri" style="width:100%;margin-top:12px;padding:10px">Edit profile</button>
    </div>` + tabbar(["Home","Search","Profile"], 2)
  );
}

function mobileOnboarding(ctx) {
  return (
    `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:20px;background:linear-gradient(160deg,var(--brand-background),var(--brand-card-subtle))">
      <div style="width:80px;height:80px;border-radius:20px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));box-shadow:inset 0 2px #fff6,0 8px 20px rgba(0,0,0,.12);margin-bottom:18px"></div>
      <div style="${FS(18)};font-weight:900">${ctx.heading}</div>
      <div class="vg-muted" style="${FS(10)};margin-top:6px;max-width:220px">${ctx.subtitle}. Connect your accounts and let the agents work autonomously.</div>
      <button class="vg-btn pri" style="margin-top:20px;padding:10px 24px">Get started</button>
    </div>` +
    `<div class="vg-row vg-center" style="gap:6px;padding:14px"><div style="width:24px;height:4px;border-radius:9999px;background:var(--brand-primary)"></div><div style="width:8px;height:4px;border-radius:9999px;background:var(--brand-muted)"></div><div style="width:8px;height:4px;border-radius:9999px;background:var(--brand-muted)"></div></div>`
  );
}

/* ---------- RECIPE layouts ---------- */
function recipeLanding(ctx) {
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto">
      <div class="vg-nav">${logo(ctx)}<div style="flex:1"></div><button class="vg-btn out" style="padding:4px 10px">Sign in</button><button class="vg-btn pri" style="padding:4px 10px">Start free</button></div>
      <div style="padding:28px 20px;text-align:center">
        <div style="${FS(22)};font-weight:900;line-height:1.15">${ctx.heading}</div>
        <div class="vg-muted" style="${FS(11)};margin-top:8px;max-width:320px;margin-left:auto;margin-right:auto">${ctx.subtitle}. Deploy autonomous agent fleets in minutes.</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:16px"><button class="vg-btn pri" style="padding:9px 18px">Start free trial</button><button class="vg-btn out" style="padding:9px 18px">Book demo</button></div>
      </div>
      <div style="padding:0 20px 20px"><div style="aspect-ratio:2.2;border-radius:14px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary) 50%,var(--brand-gold-deep));border:1px solid var(--brand-border)"></div></div>
    </div>`
  );
}

function recipePricing(ctx) {
  const plans = [["Starter","$0","Free forever"],["Pro","$49","Per month"],["Enterprise","Custom","Contact us"]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="${FS(16)};font-weight:900;text-align:center">Simple, transparent pricing</div>
      <div class="vg-muted" style="${FS(9)};text-align:center;margin-top:4px">Choose your plan</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:16px">
        ${plans.map((p,i)=>`<div class="vg-card" style="text-align:center;${i===1?"border-color:var(--brand-primary);border-width:2px":""}"><div style="${FS(9)};font-weight:700;color:var(--brand-muted-foreground);text-transform:uppercase">${p[0]}</div><div style="${FS(18)};font-weight:900;margin-top:4px">${p[1]}</div><div class="vg-muted" style="${FS(8)}">${p[2]}</div><button class="vg-btn ${i===1?"pri":"out"}" style="width:100%;margin-top:10px;padding:7px">${i===1?"Choose":"Select"}</button></div>`).join("")}
      </div>
    </div>`
  );
}

function recipeFeatureGrid(ctx) {
  const features = [["⚡","Fast","Deploy in minutes"],["🤖","Autonomous","AI agent fleets"],["🔒","Secure","Enterprise-grade"],["📊","Insights","Real-time analytics"],["🌐","Global","Multi-region"],["🔧","Flexible","Custom workflows"]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="${FS(15)};font-weight:900;text-align:center">Everything you need</div>
      <div class="vg-muted" style="${FS(9)};text-align:center;margin-top:3px;margin-bottom:14px">Powerful features out of the box</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        ${features.map(f=>`<div class="vg-card" style="text-align:center;padding:12px 8px"><div style="${FS(18)}">${f[0]}</div><div style="${FS(10)};font-weight:700;margin-top:6px">${f[1]}</div><div class="vg-muted" style="${FS(8)};margin-top:3px">${f[2]}</div></div>`).join("")}
      </div>
    </div>`
  );
}

function recipeTestimonial(ctx) {
  const quotes = [["This platform transformed our workflow entirely.","Sarah K., CEO"],["We scaled 10x in 3 months.","Daniel R., CTO"],["Best investment we made this year.","Maya P., Founder"]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="${FS(15)};font-weight:900;text-align:center">Loved by teams</div>
      <div class="vg-muted" style="${FS(9)};text-align:center;margin-top:3px;margin-bottom:14px">Don't just take our word for it</div>
      ${quotes.map((q,i)=>`<div class="vg-card" style="margin-bottom:8px;${i===0?"border-color:var(--brand-primary)":""}"><div style="${FS(10)};font-style:italic">"${q[0]}"</div><div class="vg-row vg-gap2" style="margin-top:8px"><div class="vg-avatar"></div><span style="${FS(9)};font-weight:700">${q[1]}</span></div></div>`).join("")}
    </div>`
  );
}

function recipeFaq(ctx) {
  const faqs = [["How does pricing work?","Free tier, then $49/mo for Pro."],["Can I cancel anytime?","Yes, no contracts or commitments."],["Is my data secure?","Enterprise-grade encryption and SOC2."],["Do you offer support?","24/7 chat and email support."]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="${FS(15)};font-weight:900;text-align:center">Frequently asked questions</div>
      <div class="vg-muted" style="${FS(9)};text-align:center;margin-top:3px;margin-bottom:14px">Everything you need to know</div>
      ${faqs.map((f,i)=>`<div class="vg-card" style="margin-bottom:6px"><div class="vg-row vg-between"><span style="${FS(10)};font-weight:700">${f[0]}</span><span style="${FS(12)};color:var(--brand-primary)">${i===0?"−":"+"}</span></div>${i===0?`<div class="vg-muted" style="${FS(9)};margin-top:6px">${f[1]}</div>`:""}</div>`).join("")}
    </div>`
  );
}

function recipeCtaBanner(ctx) {
  return (
    `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:24px;background:linear-gradient(135deg,var(--brand-secondary),var(--brand-primary) 60%,var(--brand-gold-bright));color:#fff">
      <div style="${FS(18)};font-weight:900">Ready to get started?</div>
      <div style="${FS(10)};opacity:.9;margin-top:6px;max-width:280px">Join thousands of teams already building with ${ctx.brandName}.</div>
      <div style="display:flex;gap:8px;margin-top:16px"><button style="background:#fff;color:var(--brand-primary);border:0;padding:9px 20px;border-radius:8px;font-weight:700;font-size:calc(10px * var(--vg-font-scale,1))">Start free</button><button style="background:transparent;border:1px solid #fff5;color:#fff;padding:9px 20px;border-radius:8px;font-weight:700;font-size:calc(10px * var(--vg-font-scale,1))">Talk to us</button></div>
    </div>`
  );
}

function recipeStatsBand(ctx) {
  const stats = [["10k+","Active users"],["99.9%","Uptime"],["50ms","Avg latency"],["24/7","Support"]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="${FS(14)};font-weight:900;text-align:center;margin-bottom:14px">Trusted by teams worldwide</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${stats.map(s=>`<div style="text-align:center;padding:12px;border:1px solid var(--brand-border);border-radius:10px;background:var(--brand-surface)"><div style="${FS(20)};font-weight:900;color:var(--brand-primary)">${s[0]}</div><div class="vg-muted" style="${FS(8)};text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${s[1]}</div></div>`).join("")}
      </div>
    </div>`
  );
}

function recipeLogoCloud(ctx) {
  const logos = ["Acme","Globex","Initech","Umbrella","Hooli","Soylent"];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div class="vg-muted" style="${FS(9)};text-align:center;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px">Powering teams at</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${logos.map(l=>`<div style="text-align:center;padding:14px;border:1px solid var(--brand-border);border-radius:8px;background:var(--brand-surface);font-size:calc(12px * var(--vg-font-scale,1));font-weight:900;color:var(--brand-muted-foreground)">${l}</div>`).join("")}
      </div>
    </div>`
  );
}

function recipeTimeline(ctx) {
  const steps = [["Q1 2026","Platform launch"],["Q2 2026","Agent fleet v2"],["Q3 2026","Global rollout"],["Q4 2026","Enterprise GA"]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="${FS(14)};font-weight:900;margin-bottom:14px">Our roadmap</div>
      <div class="vg-flow">
        ${steps.map((s,i)=>`<div class="step ${i===0?"on":""}"><div class="n">${i+1}</div><div style="flex:1"><div style="${FS(10)};font-weight:700">${s[0]}</div><div class="vg-muted" style="${FS(8)}">${s[1]}</div></div></div>`).join("")}
      </div>
    </div>`
  );
}

function recipeGallery(ctx) {
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px">
      <div style="${FS(13)};font-weight:900;margin-bottom:10px">Gallery</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${Array.from({length:6},(_,i)=>`<div style="aspect-ratio:${i%2===0?"1":"1.5"};border-radius:10px;border:1px solid var(--brand-border);background:linear-gradient(${135+i*30}deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep))"></div>`).join("")}
      </div>
    </div>`
  );
}

function recipeTeam(ctx) {
  const team = [["Sarah K.","CEO"],["Daniel R.","CTO"],["Maya P.","Design"],["Leo T.","Engineering"]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="${FS(14)};font-weight:900;text-align:center;margin-bottom:14px">Meet the team</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${team.map(m=>`<div style="text-align:center;padding:12px;border:1px solid var(--brand-border);border-radius:10px;background:var(--brand-surface)"><div style="width:40px;height:40px;border-radius:9999px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));margin:0 auto 8px;box-shadow:inset 0 1px #fff6"></div><div style="${FS(10)};font-weight:700">${m[0]}</div><div class="vg-muted" style="${FS(8)}">${m[1]}</div></div>`).join("")}
      </div>
    </div>`
  );
}

function recipeContact(ctx) {
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="${FS(14)};font-weight:900;text-align:center;margin-bottom:14px">Get in touch</div>
      <div class="vg-card" style="margin-bottom:8px"><div class="vg-muted" style="${FS(8)};text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Name</div><div style="height:14px;border:1px solid var(--brand-border);border-radius:6px;background:var(--brand-muted)"></div></div>
      <div class="vg-card" style="margin-bottom:8px"><div class="vg-muted" style="${FS(8)};text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Email</div><div style="height:14px;border:1px solid var(--brand-border);border-radius:6px;background:var(--brand-muted)"></div></div>
      <div class="vg-card" style="margin-bottom:10px"><div class="vg-muted" style="${FS(8)};text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Message</div><div style="height:40px;border:1px solid var(--brand-border);border-radius:6px;background:var(--brand-muted)"></div></div>
      <button class="vg-btn pri" style="width:100%;padding:10px">Send message</button>
    </div>`
  );
}

/* ---------- GENERATOR layouts ---------- */
function genBusinessCard(ctx) {
  return (
    `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:16px;background:linear-gradient(135deg,var(--brand-background),var(--brand-card-subtle))">
      <div style="width:260px;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.14);border:1px solid var(--brand-border)">
        <div style="background:linear-gradient(135deg,var(--brand-secondary),var(--brand-primary));padding:14px;color:#fff">
          <div style="display:flex;align-items:center;gap:8px">${logo(ctx)}<div style="flex:1"></div><div style="width:32px;height:32px;border-radius:8px;background:#ffffff26;box-shadow:inset 0 1px #fff4"></div></div>
          <div style="${FS(15)};font-weight:900;margin-top:14px">${ctx.brandName}</div>
          <div style="${FS(9)};opacity:.85">${ctx.subtitle}</div>
        </div>
        <div style="background:var(--brand-surface);padding:12px">
          <div style="${FS(10)};font-weight:700">${ctx.heading}</div>
          <div class="vg-muted" style="${FS(8)};margin-top:2px">Founder & CEO</div>
          <div style="display:flex;flex-direction:column;gap:3px;margin-top:10px">
            <div class="vg-row vg-gap2"><span style="color:var(--brand-primary)">✉</span><span style="${FS(8)}">hello@${String(ctx.brandName||"brand").toLowerCase().replace(/\\s/g,"")}.com</span></div>
            <div class="vg-row vg-gap2"><span style="color:var(--brand-primary)">☎</span><span style="${FS(8)}">+1 (555) 012-3456</span></div>
            <div class="vg-row vg-gap2"><span style="color:var(--brand-primary)">⌖</span><span style="${FS(8)}">San Francisco, CA</span></div>
          </div>
        </div>
      </div>
    </div>`
  );
}

function genBrochure(ctx) {
  const panels = [
    ["About", "We build autonomous agent fleets for modern teams."],
    ["Services", "Strategy, design, development, and growth."],
    ["Results", "10x faster delivery, 99.9% uptime."],
  ];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;height:100%">
        ${panels.map((p, i) => `<div style="border:1px solid var(--brand-border);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;background:var(--brand-surface)">
          <div style="background:${i === 0 ? "linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep))" : "var(--brand-muted)"};padding:10px;flex:none;${i === 0 ? "color:#fff" : ""}">
            <div style="${FS(11)};font-weight:900">${i === 0 ? ctx.brandName : p[0]}</div>
          </div>
          <div style="padding:10px;flex:1;display:flex;flex-direction:column;gap:5px">
            ${i === 0 ? `<div class="vg-muted" style="${FS(8)}">${ctx.subtitle}</div><div style="${FS(9)};font-weight:700;margin-top:6px">${p[0]}</div><div style="${FS(8)}">${p[1]}</div>` : `<div style="${FS(9)};font-weight:700">${p[0]}</div><div class="vg-muted" style="${FS(8)}">${p[1]}</div><div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">${Array.from({length:3},(_,j)=>`<div style="height:5px;border-radius:9999px;background:var(--brand-muted);width:${50+j*15}%"></div>`).join("")}</div>`}
          </div>
        </div>`).join("")}
      </div>
    </div>`
  );
}

function genVideoCard(ctx) {
  return (
    `<div style="flex:1;display:flex;flex-direction:column;padding:12px;gap:10px">
      <div style="flex:1;border-radius:14px;overflow:hidden;position:relative;background:linear-gradient(135deg,var(--brand-background),var(--brand-surface));border:1px solid var(--brand-border);min-height:180px">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,var(--vg-chip-bg),transparent 60%)"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:9999px;background:var(--brand-primary);display:flex;align-items:center;justify-content:center;box-shadow:0 0 24px var(--brand-primary)"><span style="font-size:18px;color:var(--brand-on-primary)">▶</span></div>
        <div style="position:absolute;bottom:10px;left:10px;right:10px;display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:4px;border-radius:9999px;background:#ffffff33;overflow:hidden"><div style="width:35%;height:100%;background:var(--brand-primary);border-radius:9999px"></div></div>
          <span style="${FS(8)};color:#fff;font-weight:700">0:07</span>
        </div>
      </div>
      <div class="vg-card" style="padding:10px">
        <div style="${FS(11)};font-weight:900">${ctx.heading}</div>
        <div class="vg-muted" style="${FS(9)};margin-top:3px">${ctx.subtitle}</div>
        <div class="vg-row vg-gap2" style="margin-top:8px"><button class="vg-btn pri" style="padding:6px 12px">Generate</button><button class="vg-btn out" style="padding:6px 12px">Customize</button></div>
      </div>
    </div>`
  );
}

function genInvoice(ctx) {
  const items = [["Design services","40h","$120","$4,800"],["Development","60h","$95","$5,700"],["Consulting","8h","$150","$1,200"]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div class="vg-row vg-between" style="margin-bottom:12px"><div><div style="${FS(16)};font-weight:900">INVOICE</div><div class="vg-muted" style="${FS(9)}">#INV-2026-041</div></div><div style="text-align:right"><div style="${FS(11)};font-weight:900">${ctx.brandName}</div><div class="vg-muted" style="${FS(8)}">Issued: Oct 5, 2026</div></div></div>
      <div class="vg-card" style="margin-bottom:10px"><div class="vg-table"><div class="h" style="font-size:calc(8px * var(--vg-font-scale,1))"><span>Description</span><span>Qty</span><span>Rate</span><span>Total</span></div>${items.map(r=>`<div class="r" style="font-size:calc(9px * var(--vg-font-scale,1))"><span>${r[0]}</span><span class="vg-muted">${r[1]}</span><span>${r[2]}</span><span style="font-weight:700">${r[3]}</span></div>`).join("")}</div></div>
      <div class="vg-row vg-between" style="padding:8px 0"><span class="vg-muted" style="${FS(9)}">Subtotal</span><span style="${FS(10)};font-weight:700">$11,700</span></div>
      <div class="vg-row vg-between" style="padding:4px 0"><span class="vg-muted" style="${FS(9)}">Tax (8.5%)</span><span style="${FS(10)}">$994.50</span></div>
      <div class="vg-row vg-between" style="border-top:2px solid var(--brand-primary);padding-top:8px;margin-top:4px"><span style="${FS(12)};font-weight:900">Total Due</span><span style="${FS(14)};font-weight:900;color:var(--brand-primary)">$12,694.50</span></div>
    </div>`
  );
}

function genResume(ctx) {
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:16px">
      <div style="display:flex;gap:12px;margin-bottom:12px;border-bottom:2px solid var(--brand-primary);padding-bottom:10px">
        <div style="width:48px;height:48px;border-radius:9999px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));flex:none;box-shadow:inset 0 1px #fff6"></div>
        <div style="flex:1"><div style="${FS(15)};font-weight:900">${ctx.heading}</div><div class="vg-muted" style="${FS(9)}">${ctx.subtitle}</div><div style="${FS(8)};color:var(--brand-primary);margin-top:2px">San Francisco · linkedin.com/in/${String(ctx.brandName||"profile").toLowerCase().replace(/\\s/g,"")}</div></div>
      </div>
      <div style="${FS(10)};font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--brand-primary);margin-bottom:5px">Experience</div>
      ${[["Senior Engineer","Acme Corp · 2023-Present"],["Engineer","Globex · 2020-2023"]].map(e=>`<div class="vg-card" style="margin-bottom:6px;padding:8px"><div style="${FS(10)};font-weight:700">${e[0]}</div><div class="vg-muted" style="${FS(8)}">${e[1]}</div><div style="display:flex;flex-direction:column;gap:3px;margin-top:6px">${Array.from({length:2},(_,i)=>`<div style="height:4px;border-radius:9999px;background:var(--brand-muted);width:${60+i*20}%"></div>`).join("")}</div></div>`).join("")}
      <div style="${FS(10)};font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--brand-primary);margin:10px 0 5px">Skills</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${["React","TypeScript","Node","Python","AWS","Docker"].map(s=>`<span class="vg-chip">${s}</span>`).join("")}</div>
    </div>`
  );
}

function genCertificate(ctx) {
  return (
    `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--brand-card-subtle)">
      <div style="width:280px;border:3px double var(--brand-gold-deep);border-radius:10px;background:var(--brand-surface);padding:20px;text-align:center;position:relative">
        <div style="position:absolute;top:8px;left:8px;right:8px;bottom:8px;border:1px solid var(--brand-gold-light);border-radius:6px;pointer-events:none"></div>
        <div style="${FS(9)};text-transform:uppercase;letter-spacing:.1em;color:var(--brand-gold-deep);font-weight:700">Certificate of Achievement</div>
        <div style="${FS(20)};font-weight:900;margin:10px 0 4px">Awarded to</div>
        <div style="${FS(14)};font-weight:900;color:var(--brand-primary)">${ctx.brandName}</div>
        <div class="vg-muted" style="${FS(9)};margin-top:8px;max-width:220px;margin-left:auto;margin-right:auto">${ctx.subtitle}</div>
        <div style="display:flex;justify-content:space-between;margin-top:18px;padding:0 10px"><div style="text-align:left"><div style="border-top:1px solid var(--brand-text);width:70px;padding-top:3px"><div style="${FS(7)};font-weight:700">Date</div></div></div><div style="width:36px;height:36px;border-radius:9999px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-gold-deep));box-shadow:inset 0 1px #fff6"></div><div style="text-align:right"><div style="border-top:1px solid var(--brand-text);width:70px;padding-top:3px"><div style="${FS(7)};font-weight:700">Signature</div></div></div></div>
      </div>
    </div>`
  );
}

function genPoster(ctx) {
  return (
    `<div style="flex:1;display:flex;flex-direction:column;background:linear-gradient(160deg,var(--brand-background),var(--brand-surface));color:#fff;overflow:hidden">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:20px;position:relative">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,var(--vg-chip-bg),transparent 60%)"></div>
        <div style="position:relative"><div style="${FS(9)};text-transform:uppercase;letter-spacing:.15em;color:var(--brand-primary);font-weight:700">Live Event</div><div style="${FS(24)};font-weight:900;line-height:1.1;margin-top:8px">${ctx.heading}</div><div style="${FS(11)};opacity:.8;margin-top:8px;max-width:240px">${ctx.subtitle}</div></div>
      </div>
      <div style="padding:14px 20px;background:#ffffff12;backdrop-filter:blur(8px);border-top:1px solid #ffffff22">
        <div class="vg-row vg-between"><div><div style="${FS(10)};font-weight:700">Oct 15, 2026 · 7PM</div><div style="${FS(8)};opacity:.7">Grand Hall, SF</div></div><button style="background:var(--brand-primary);color:var(--brand-on-primary);border:0;padding:8px 16px;border-radius:8px;font-weight:900;font-size:calc(10px * var(--vg-font-scale,1))">Get tickets</button></div>
      </div>
    </div>`
  );
}

function genSocialPost(ctx) {
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px">
      <div class="vg-card" style="padding:0;overflow:hidden">
        <div style="aspect-ratio:1;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary) 50%,var(--brand-gold-deep));position:relative">
          <div style="position:absolute;inset:14px;border:1px solid #fff5;border-radius:10px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#fff;padding:14px">
            <div style="${FS(16)};font-weight:900;line-height:1.15">${ctx.heading}</div>
            <div style="${FS(9)};opacity:.9;margin-top:6px">${ctx.subtitle}</div>
            <div style="margin-top:10px;background:#fff;color:var(--brand-primary);padding:5px 12px;border-radius:9999px;font-size:calc(8px * var(--vg-font-scale,1));font-weight:900">${ctx.brandName}</div>
          </div>
        </div>
      </div>
      <div class="vg-row vg-gap2" style="justify-content:center"><button class="vg-btn pri" style="padding:7px 14px">Download</button><button class="vg-btn out" style="padding:7px 14px">Share</button></div>
    </div>`
  );
}

function genNewsletter(ctx) {
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto">
      <div style="background:var(--brand-primary);padding:10px 16px;color:var(--brand-on-primary);text-align:center"><div style="${FS(9)};font-weight:900;text-transform:uppercase;letter-spacing:.08em">${ctx.brandName} · Weekly</div></div>
      <div style="padding:16px">
        <div style="${FS(16)};font-weight:900">${ctx.heading}</div>
        <div class="vg-muted" style="${FS(9)};margin-top:3px">${ctx.subtitle}</div>
        <div style="aspect-ratio:2.4;border-radius:10px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));margin:12px 0;border:1px solid var(--brand-border)"></div>
        <div style="display:flex;flex-direction:column;gap:5px">${Array.from({length:4},(_,i)=>`<div style="height:6px;border-radius:9999px;background:var(--brand-muted);width:${i===0?"100%":65+((i*17)%30)}%"></div>`).join("")}</div>
        <button class="vg-btn pri" style="margin-top:12px;padding:8px 16px">Read more</button>
      </div>
      <div style="padding:10px 16px;border-top:1px solid var(--brand-border);background:var(--brand-muted);text-align:center"><div class="vg-muted" style="${FS(8)}">Unsubscribe · ${ctx.brandName}</div></div>
    </div>`
  );
}

function genQrCard(ctx) {
  const cells = Array.from({length:49},(_,i)=>{const r=Math.floor(i/7),c=i%7;return(r===0||r===6||c===0||c===6||(r<3&&c<3)||(r<3&&c>3)||(r>3&&c<3)||(r>3&&c>3))?(i%3===0?1:0):(i%2===0?1:0);});
  return (
    `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;background:var(--brand-card-subtle)">
      <div style="width:180px;background:var(--brand-surface);border-radius:14px;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.1);border:1px solid var(--brand-border)">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:10px">${cells.map(c=>`<div style="aspect-ratio:1;border-radius:2px;background:${c?"var(--brand-text)":"transparent"}"></div>`).join("")}</div>
        <div style="text-align:center"><div style="${FS(11)};font-weight:900">${ctx.brandName}</div><div class="vg-muted" style="${FS(8)};margin-top:2px">${ctx.subtitle}</div></div>
      </div>
      <div style="${FS(9)};color:var(--brand-muted-foreground);margin-top:12px">Scan to connect</div>
    </div>`
  );
}

function genMenuCard(ctx) {
  const items = [["Margherita","Fresh basil, mozzarella","$12"],["Pepperoni","San Marzano sauce","$14"],["Quattro Formaggi","Four cheese blend","$16"],["Prosciutto","Aged prosciutto, arugula","$18"]];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto">
      <div style="background:linear-gradient(135deg,var(--brand-gold-deep),var(--brand-primary));padding:16px;color:#fff;text-align:center"><div style="${FS(9)};text-transform:uppercase;letter-spacing:.1em;opacity:.85">Menu</div><div style="${FS(18)};font-weight:900;margin-top:4px">${ctx.brandName}</div><div style="${FS(9)};opacity:.85">Wood-fired pizza</div></div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px">
        ${items.map((it,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px dashed var(--brand-border)"><div style="${FS(10)};font-weight:900;color:var(--brand-gold-deep);width:18px">${String(i+1).padStart(2,"0")}</div><div style="flex:1"><div style="${FS(11)};font-weight:700">${it[0]}</div><div class="vg-muted" style="${FS(8)}">${it[1]}</div></div><div style="${FS(12)};font-weight:900;color:var(--brand-primary)">${it[2]}</div></div>`).join("")}
      </div>
    </div>`
  );
}

function genTicket(ctx) {
  return (
    `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--brand-card-subtle)">
      <div style="width:260px;background:var(--brand-surface);border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.12);border:1px solid var(--brand-border)">
        <div style="background:linear-gradient(135deg,var(--brand-secondary),var(--brand-primary));padding:14px;color:#fff"><div style="${FS(9)};text-transform:uppercase;letter-spacing:.1em;opacity:.85">Admit One</div><div style="${FS(15)};font-weight:900;margin-top:4px">${ctx.heading}</div><div style="${FS(9)};opacity:.85;margin-top:2px">${ctx.subtitle}</div></div>
        <div style="display:flex"><div style="flex:1;padding:12px"><div style="${FS(8)};text-transform:uppercase;color:var(--brand-muted-foreground)">Date</div><div style="${FS(10)};font-weight:700">Oct 15</div></div><div style="width:1px;background:var(--brand-border);position:relative"><div style="position:absolute;top:-6px;left:-6px;width:12px;height:12px;border-radius:9999px;background:var(--brand-card-subtle);border:1px solid var(--brand-border)"></div><div style="position:absolute;bottom:-6px;left:-6px;width:12px;height:12px;border-radius:9999px;background:var(--brand-card-subtle);border:1px solid var(--brand-border)"></div></div><div style="flex:1;padding:12px"><div style="${FS(8)};text-transform:uppercase;color:var(--brand-muted-foreground)">Seat</div><div style="${FS(10)};font-weight:700">A-12</div></div></div>
        <div style="padding:10px 12px;border-top:1px dashed var(--brand-border);display:flex;align-items:center;gap:8px"><div style="display:flex;gap:1px">${Array.from({length:12},(_,i)=>`<div style="width:2px;height:24px;background:${i%2?"var(--brand-text)":"var(--brand-muted)"}"></div>`).join("")}</div><div style="${FS(8)};font-weight:700">#TX-2026-0410</div></div>
      </div>
    </div>`
  );
}

function genRealEstate(ctx) {
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto">
      <div style="aspect-ratio:1.6;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary) 40%,var(--brand-gold-deep));position:relative"><div style="position:absolute;top:10px;left:10px;background:var(--brand-primary);color:var(--brand-on-primary);padding:4px 10px;border-radius:6px;font-size:calc(9px * var(--vg-font-scale,1));font-weight:900">FOR SALE</div><div style="position:absolute;bottom:10px;right:10px;background:var(--brand-surface);padding:5px 10px;border-radius:6px;font-size:calc(10px * var(--vg-font-scale,1));font-weight:900;color:var(--brand-text)">$1,250,000</div></div>
      <div style="padding:12px"><div style="${FS(14)};font-weight:900">${ctx.heading}</div><div class="vg-muted" style="${FS(9)};margin-top:2px">${ctx.subtitle} · San Francisco, CA</div>
      <div class="vg-row vg-gap2" style="margin-top:10px"><span class="vg-chip">4 Beds</span><span class="vg-chip">3 Baths</span><span class="vg-chip">2,400 sqft</span></div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:10px">${Array.from({length:3},(_,i)=>`<div style="height:5px;border-radius:9999px;background:var(--brand-muted);width:${70+i*10}%"></div>`).join("")}</div>
      <button class="vg-btn pri" style="width:100%;margin-top:12px;padding:9px">Schedule tour</button></div>
    </div>`
  );
}

function genLogoStudio(ctx) {
  const variants = ["wordmark","monogram","emblem","abstract","lettermark"];
  return (
    `<div class="vg-scroll" style="flex:1;overflow:auto;padding:12px">
      <div style="${FS(13)};font-weight:900;margin-bottom:3px">Logo Studio</div><div class="vg-muted" style="${FS(9)};margin-bottom:12px">${ctx.brandName} · 5 variants</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${variants.map((v,i)=>`<div class="vg-card" style="aspect-ratio:1.3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:${i%2?"var(--brand-surface)":"var(--brand-muted)"}">
          ${v==="wordmark"?`<div style="${FS(14)};font-weight:900;color:var(--brand-primary)">${ctx.brandName}</div>`:v==="monogram"?`<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:calc(14px * var(--vg-font-scale,1))">${(ctx.brandName||"C")[0]}</div>`:v==="emblem"?`<div style="width:40px;height:40px;border-radius:9999px;border:2px solid var(--brand-primary);display:flex;align-items:center;justify-content:center"><span style="${FS(12)};font-weight:900;color:var(--brand-primary)">${(ctx.brandName||"C")[0]}</span></div>`:v==="abstract"?`<div style="width:36px;height:36px;background:conic-gradient(from 45deg,var(--brand-gold-light),var(--brand-primary),var(--brand-gold-deep));border-radius:8px;transform:rotate(${i*15}deg)"></div>`:`<div style="display:flex;gap:2px">${String(ctx.brandName||"CB").slice(0,2).split("").map(l=>`<div style="width:16px;height:16px;border-radius:4px;background:var(--brand-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:calc(9px * var(--vg-font-scale,1))">${l}</div>`).join("")}</div>`}
          <div style="${FS(8)};font-weight:700;color:var(--brand-muted-foreground);text-transform:uppercase">${v}</div>
        </div>`).join("")}
      </div>
    </div>`
  );
}

/* ---------- RENDERER DISPATCH ---------- */
const RENDERERS = {
  sidebar_workspace: sidebarWorkspace, topnav_workspace: topnavWorkspace, data_table: dataTable,
  analytics, kanban, email_hub: emailHub, file_manager: fileManager, calendar: calendarGrid,
  settings: settingsPanel, crm_pipeline: crmPipeline, content_editor: contentEditor, media_library: mediaLibrary,
  mobile_feed: mobileFeed, mobile_wallet: mobileWallet, mobile_scanner: mobileScanner, mobile_checkout: mobileCheckout,
  mobile_fitness: mobileFitness, mobile_food_menu: mobileFoodMenu, mobile_ride: mobileRide, mobile_notes: mobileNotes,
  mobile_habits: mobileHabits, mobile_chat: mobileChat, mobile_profile: mobileProfile, mobile_onboarding: mobileOnboarding,
  recipe_landing: recipeLanding, recipe_pricing: recipePricing, recipe_feature_grid: recipeFeatureGrid,
  recipe_testimonial: recipeTestimonial, recipe_faq: recipeFaq, recipe_cta_banner: recipeCtaBanner,
  recipe_stats_band: recipeStatsBand, recipe_logo_cloud: recipeLogoCloud, recipe_timeline: recipeTimeline,
  recipe_gallery: recipeGallery, recipe_team: recipeTeam, recipe_contact: recipeContact,
  gen_business_card: genBusinessCard, gen_brochure: genBrochure, gen_video_card: genVideoCard,
  gen_invoice: genInvoice, gen_resume: genResume, gen_certificate: genCertificate,
  gen_poster: genPoster, gen_social_post: genSocialPost, gen_newsletter: genNewsletter,
  gen_qr_card: genQrCard, gen_menu_card: genMenuCard, gen_ticket: genTicket,
  gen_real_estate: genRealEstate, gen_logo_studio: genLogoStudio,
};

export function renderPreview(templateId, config) {
  const ctx = ctxd(config);
  const fn = RENDERERS[templateId];
  if (!fn) return `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--brand-muted-foreground);font-size:calc(11px * var(--vg-font-scale,1))">Unknown template: ${templateId}</div>`;
  return fn(ctx);
}

export function getFamily(key) {
  return GALLERY_FAMILIES.find((f) => f.key === key);
}