import fs from "fs";
import { CRAWL_DELAY_MS, CRAWL_MAX_DEPTH, CRAWL_MAX_PAGES, DEFAULT_EGRESS_POLICY, DEFAULT_TIMEOUT, DOWNLOAD_MAX_BYTES } from "./config.js";
import { locate, normalizeCookies, savedStates } from "./runtime.js";
import { validateEgressUrl } from "../ssrf.js";

async function solveCaptcha(page, options) {
  const apiKey = options.apiKey;
  if (!apiKey) throw new Error("CAPTCHA API key required");
  if (options.type !== "recaptcha_v2") throw new Error(`Unsupported CAPTCHA type: ${options.type}`);
  const submit = await fetch("https://2captcha.com/in.php", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: apiKey, method: "userrecaptcha", googlekey: options.siteKey, pageurl: page.url(), json: 1 }),
  });
  const ticket = await submit.json();
  if (ticket.status !== 1) throw new Error(ticket.request || "CAPTCHA submit failed");
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const response = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${ticket.request}&json=1`);
    const result = await response.json();
    if (result.status === 1) {
      await page.evaluate((token) => { const el = document.getElementById("g-recaptcha-response"); if (el) el.innerHTML = token; }, result.request);
      return { solved: true, token: result.request };
    }
    if (result.request !== "CAPCHA_NOT_READY") throw new Error(result.request);
  }
  throw new Error("CAPTCHA solving timed out");
}

async function crawl(page, options, policy) {
  const startUrl = options.startUrl || page.url();
  const maxPages = Math.min(options.maxPages || CRAWL_MAX_PAGES, CRAWL_MAX_PAGES);
  const maxDepth = Math.min(options.maxDepth || CRAWL_MAX_DEPTH, CRAWL_MAX_DEPTH);
  const delay = Math.max(options.delay || CRAWL_DELAY_MS, 200);
  const initial = await validateEgressUrl(startUrl, policy);
  if (!initial.ok) throw new Error(`Crawl start rejected: ${initial.error}`);
  const domain = options.domain || initial.parsed.hostname;
  const visited = new Set();
  const results = [];
  const queue = [{ url: startUrl, depth: 0 }];

  while (queue.length && results.length < maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url) || depth > maxDepth) continue;
    const verdict = await validateEgressUrl(url, policy);
    if (!verdict.ok || verdict.parsed.hostname !== domain) continue;
    visited.add(url);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout || DEFAULT_TIMEOUT });
      const title = await page.title().catch(() => "");
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 5000) || "").catch(() => "");
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((href) => href.startsWith("http")));
      results.push({ url, title, text: text.slice(0, 1000), depth });
      if (depth < maxDepth) for (const link of links) if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 });
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) { results.push({ url, error: error.message, depth }); }
  }
  return { pages: results, visited: visited.size, truncated: results.length >= maxPages };
}

async function paginate(page, options) {
  const maxPages = Math.min(options.maxPages || 10, 50);
  const selector = options.nextSelector || options.selector;
  const results = [];
  for (let i = 0; i < maxPages; i++) {
    try {
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 5000) || "");
      results.push({ page: i + 1, url: page.url(), text });
      if (!selector) break;
      await (await locate(page, selector)).click({ timeout: options.timeout || DEFAULT_TIMEOUT });
      await page.waitForLoadState("domcontentloaded", { timeout: options.timeout || DEFAULT_TIMEOUT });
    } catch (error) { results.push({ page: i + 1, error: error.message }); break; }
  }
  return { pages: results, truncated: results.length >= maxPages };
}

export async function executeAction(session, input, workerId) {
  const { action_type, selector, value, options = {} } = input || {};
  let page = session.page;
  session.lastActivity = Date.now();
  session.status = "running";
  const result = { ok: true, action_type, worker_id: workerId };
  const policy = session.egressPolicy || DEFAULT_EGRESS_POLICY;

  if (["goto", "crawl"].includes(action_type)) {
    const target = action_type === "goto" ? (value || selector) : (options.startUrl || page.url());
    if (target && target !== "about:blank") {
      const verdict = await validateEgressUrl(target, policy);
      if (!verdict.ok) throw new Error(`URL rejected: ${verdict.error}`);
    }
  }

  switch (action_type) {
    case "goto": await page.goto(value || selector, { waitUntil: options.waitUntil || "domcontentloaded", timeout: options.timeout || DEFAULT_TIMEOUT }); break;
    case "back": await page.goBack({ timeout: options.timeout || DEFAULT_TIMEOUT }); break;
    case "forward": await page.goForward({ timeout: options.timeout || DEFAULT_TIMEOUT }); break;
    case "reload": await page.reload({ timeout: options.timeout || DEFAULT_TIMEOUT }); break;
    case "wait_for_selector": await page.waitForSelector(selector, { timeout: options.timeout || DEFAULT_TIMEOUT, state: options.state || "visible" }); break;
    case "wait_for_load_state": await page.waitForLoadState(options.state || "networkidle", { timeout: options.timeout || DEFAULT_TIMEOUT }); break;
    case "wait_for_timeout": await page.waitForTimeout(Number(value) || 1000); break;
    case "click": await (await locate(page, selector)).click({ timeout: options.timeout || DEFAULT_TIMEOUT, button: options.button || "left" }); break;
    case "hover": await (await locate(page, selector)).hover(); break;
    case "type": await (await locate(page, selector)).type(value || "", { delay: options.delay || 0 }); break;
    case "fill": await (await locate(page, selector)).fill(value || ""); break;
    case "press": await page.keyboard.press(value || selector); break;
    case "select_option": await (await locate(page, selector)).selectOption(value); break;
    case "scroll": selector ? await (await locate(page, selector)).scrollIntoViewIfNeeded() : await page.mouse.wheel(0, Number(value) || 500); break;
    case "drag_and_drop": await (await locate(page, selector)).dragTo(await locate(page, options.targetSelector)); break;
    case "upload_file": {
      if (typeof value !== "string" || !value.startsWith("/tmp/uploads/")) throw new Error("Upload path must be under /tmp/uploads");
      const chooserPromise = page.waitForEvent("filechooser");
      await (await locate(page, selector)).click();
      await (await chooserPromise).setFiles(value);
      break;
    }
    case "download": {
      const [download] = await Promise.all([page.waitForEvent("download"), (await locate(page, selector)).click()]);
      const filename = download.suggestedFilename().replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `/tmp/${filename}`;
      await download.saveAs(path);
      const stat = fs.statSync(path);
      if (stat.size > DOWNLOAD_MAX_BYTES) { fs.unlinkSync(path); throw new Error("Download exceeds size limit"); }
      Object.assign(result, { path, filename, size: stat.size });
      break;
    }
    case "handle_dialog": page.once("dialog", async (dialog) => options.accept ? dialog.accept(value || "") : dialog.dismiss()); break;
    case "new_tab": { const next = await session.context.newPage(); session.tabs.push(next); session.page = next; page = next; result.tabIndex = session.tabs.length - 1; break; }
    case "switch_tab": { const index = Number(value) || 0; if (!session.tabs[index]) throw new Error("Tab not found"); session.page = session.tabs[index]; page = session.page; break; }
    case "close_tab": { const index = Number(value) || 0; if (!session.tabs[index]) throw new Error("Tab not found"); await session.tabs[index].close(); session.tabs.splice(index, 1); session.page = session.tabs[0] || await session.context.newPage(); page = session.page; break; }
    case "frame_switch": { if (selector) { session.activeFrame = page.frame({ url: new RegExp(selector) }) || page.frameLocator(selector); result.switched = true; } else { session.activeFrame = page.frames()[options.index]; result.switched = Boolean(session.activeFrame); } break; }
    case "extract_text": result.data = await (await locate(page, selector)).innerText(); break;
    case "extract_html": result.data = await (await locate(page, selector)).innerHTML(); break;
    case "extract_attribute": result.data = await (await locate(page, selector)).getAttribute(options.attribute || "href"); break;
    case "extract_table": result.data = await page.evaluate((sel) => { const table = document.querySelector(sel); return table ? [...table.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("th,td")].map((cell) => cell.innerText.trim())) : []; }, selector); break;
    case "extract_json": { result.data = await page.evaluate(options.evaluateFn || `(selector) => document.querySelector(selector)?.innerText`, selector); try { result.data = JSON.parse(result.data); } catch {} break; }
    case "ai_extract": result.data = await page.evaluate(() => document.body.innerText.slice(0, 50000)); break;
    case "evaluate": { const fn = options.fn || value; result.data = typeof fn === "string" && (fn.trim().startsWith("(") || fn.trim().startsWith("function")) ? await page.evaluate(`(${fn})()`) : await page.evaluate(fn); break; }
    case "screenshot": { const buffer = await page.screenshot({ fullPage: options.fullPage || false, type: "png" }); Object.assign(result, { base64: buffer.toString("base64"), mimeType: "image/png", size: buffer.length }); break; }
    case "pdf": { const buffer = await page.pdf({ format: options.format || "A4", printBackground: options.printBackground !== false }); Object.assign(result, { base64: buffer.toString("base64"), mimeType: "application/pdf", size: buffer.length }); break; }
    case "set_cookies": await session.context.addCookies(normalizeCookies(options.cookies || [])); break;
    case "import_cookies": await session.context.addCookies(normalizeCookies(options.cookies || [])); result.imported = (options.cookies || []).length; break;
    case "export_cookies": result.data = await session.context.cookies(); result.exported = result.data.length; break;
    case "set_headers": await session.context.setExtraHTTPHeaders(options.headers || {}); break;
    case "set_local_storage": await page.evaluate(([key, storedValue]) => localStorage.setItem(key, storedValue), [options.key, options.value]); break;
    case "capture_response": result.data = await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.responseStatus || 200); break;
    case "solve_captcha": result.data = await solveCaptcha(page, options); break;
    case "mock_response": throw new Error("Runtime mock_response is disabled; declare mocks at session creation so the egress guard remains authoritative");
    case "save_state": { const stateToken = `state_${crypto.randomUUID()}`; savedStates.set(stateToken, { cookies: await session.context.cookies(), storageState: await session.context.storageState(), url: page.url(), title: await page.title() }); result.data = { stateToken, url: page.url() }; break; }
    case "restore_state": { const state = savedStates.get(options.stateToken); if (!state) throw new Error("State not found"); if (state.cookies) await session.context.addCookies(state.cookies); if (state.url) { const verdict = await validateEgressUrl(state.url, policy); if (!verdict.ok) throw new Error(`State URL rejected: ${verdict.error}`); await page.goto(state.url); } result.data = { restored: true, url: state.url }; break; }
    case "crawl": result.data = await crawl(page, options, policy); break;
    case "paginate": result.data = await paginate(page, options); break;
    default: throw Object.assign(new Error(`Unknown action_type: ${action_type}`), { status: 400 });
  }

  session.status = "idle";
  session.url = page?.url?.() || session.url;
  session.title = page ? await page.title().catch(() => session.title) : session.title;
  result.url = session.url;
  result.title = session.title;
  return result;
}
