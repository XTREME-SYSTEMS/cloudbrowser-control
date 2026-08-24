import fs from "fs";
import { CRAWL_DELAY_MS, CRAWL_MAX_DEPTH, CRAWL_MAX_PAGES, DEFAULT_EGRESS_POLICY, DEFAULT_TIMEOUT, DOWNLOAD_MAX_BYTES } from "./config.js";
import { locate, normalizeCookies, savedStates } from "./runtime.js";
import { validateEgressUrl } from "../ssrf.js";

// ═══════════════════════════════════════════════
// CAPTCHA SOLVING
// ═══════════════════════════════════════════════

const captchaEndpoints = {
  "2captcha": { submit: "https://2captcha.com/in.php", poll: "https://2captcha.com/res.php" },
  "anticaptcha": { submit: "https://api.anti-captcha.com/createTask", poll: "https://api.anti-captcha.com/getTaskResult" },
  "capmonster": { submit: "https://api.capmonster.cloud/createTask", poll: "https://api.capmonster.cloud/getTaskResult" },
};

async function solveCaptcha(page, options) {
  const apiKey = options.apiKey;
  if (!apiKey) throw new Error("CAPTCHA API key required");
  const provider = options.provider || "2captcha";
  const pageurl = page.url();
  const maxWait = options.maxWait || 150000;
  const pollInterval = 5000;
  const ep = captchaEndpoints[provider] || captchaEndpoints["2captcha"];
  const type = options.type || "recaptcha_v2";

  let submitBody, captchaId;

  if (provider === "2captcha") {
    const methodMap = {
      recaptcha_v2: "userrecaptcha",
      recaptcha_v3: "userrecaptcha",
      hcaptcha: "hcaptcha",
      turnstile: "turnstile",
      funcaptcha: "funcaptcha",
    };
    const method = methodMap[type];
    if (!method) throw new Error(`Unsupported CAPTCHA type: ${type}`);
    const body = { key: apiKey, method, pageurl, json: 1 };
    if (options.siteKey) body.googlekey = options.siteKey;
    if (type === "recaptcha_v3") { body.version = "v3"; body.action = options.action || "verify"; body.min_score = options.minScore || 0.3; }
    if (type === "hcaptcha" && options.siteKey) body.sitekey = options.siteKey;
    if (type === "turnstile" && options.siteKey) body.sitekey = options.siteKey;
    submitBody = body;
  } else {
    // anticaptcha / capmonster use createTask/getTaskResult JSON-RPC style
    const taskTypeMap = {
      recaptcha_v2: "NoCaptchaTaskProxyless",
      recaptcha_v3: "RecaptchaV3TaskProxyless",
      hcaptcha: "HCaptchaTaskProxyless",
      turnstile: "TurnstileTaskProxyless",
      funcaptcha: "FunCaptchaTaskProxyless",
    };
    const taskType = taskTypeMap[type];
    if (!taskType) throw new Error(`Unsupported CAPTCHA type: ${type}`);
    const task = { type: taskType, websiteURL: pageurl };
    if (options.siteKey) task.websiteKey = options.siteKey;
    if (type === "recaptcha_v3") { task.pageAction = options.action || "verify"; task.minScore = options.minScore || 0.3; }
    submitBody = { clientKey: apiKey, task };
  }

  // Submit — 2captcha's in.php endpoint is more reliable with form-encoded data.
  // JSON POST to in.php can inconsistently drop fields (ERROR_KEY_DOES_NOT_EXIST).
  // anticaptcha/capmonster use JSON-RPC, so keep JSON for those.
  let submitRes;
  if (provider === "2captcha") {
    const formBody = new URLSearchParams();
    for (const [k, v] of Object.entries(submitBody)) formBody.append(k, String(v));
    submitRes = await fetch(ep.submit, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
  } else {
    submitRes = await fetch(ep.submit, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submitBody),
    });
  }
  const submitData = await submitRes.json();

  if (provider === "2captcha") {
    if (submitData.status !== 1) throw new Error(submitData.request || "CAPTCHA submit failed");
    captchaId = submitData.request;
  } else {
    if (submitData.errorId) throw new Error(submitData.errorDescription || "CAPTCHA submit failed");
    captchaId = submitData.taskId;
  }

  // Poll for result
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval));
    let resData;
    if (provider === "2captcha") {
      const resRes = await fetch(`${ep.poll}?key=${apiKey}&action=get&id=${captchaId}&json=1`);
      resData = await resRes.json();
      if (resData.status === 1) {
        const token = resData.request;
        if (type === "recaptcha_v2") {
          await page.evaluate((t) => {
            const el = document.getElementById("g-recaptcha-response") || document.querySelector("textarea[name='g-recaptcha-response']");
            if (el) { el.innerHTML = t; el.value = t; }
            if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
              for (const cid of Object.keys(window.___grecaptcha_cfg.clients)) {
                const client = window.___grecaptcha_cfg.clients[cid];
                for (const prop of Object.keys(client)) {
                  const val = client[prop];
                  if (val && typeof val === "object") {
                    for (const p2 of Object.keys(val)) {
                      if (typeof val[p2] === "function" && p2.startsWith("callback")) {
                        try { val[p2](t); } catch (_) {}
                      }
                    }
                  }
                }
              }
            }
          }, token);
        }
        return { solved: true, token, provider, type };
      }
      if (resData.request !== "CAPCHA_NOT_READY") throw new Error(resData.request);
    } else {
      const resRes = await fetch(ep.poll, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: apiKey, taskId: captchaId }),
      });
      resData = await resRes.json();
      if (resData.errorId) throw new Error(resData.errorDescription || "CAPTCHA poll failed");
      if (resData.status === "ready") {
        const token = resData.solution?.gRecaptchaResponse || resData.solution?.token || resData.solution?.text || "";
        return { solved: true, token, provider, type };
      }
    }
  }
  throw new Error("CAPTCHA solving timed out");
}

async function autoSolveCaptcha(page, solverConfig) {
  if (!solverConfig || !solverConfig.apiKey) return { detected: false, solved: false };

  const captchaSelectors = [
    'iframe[src*="recaptcha/api2/anchor"]',
    'iframe[src*="recaptcha/"]',
    '.g-recaptcha[data-sitekey]',
    'iframe[src*="hcaptcha.com"]',
    '.h-captcha[data-sitekey]',
    'iframe[src*="challenges.cloudflare.com"]',
    '.cf-turnstile[data-sitekey]',
  ];
  try {
    await page.waitForSelector(captchaSelectors.join(", "), { timeout: 8000, state: "attached" });
  } catch (_e) {
    return { detected: false, solved: false };
  }

  const detections = await page.evaluate(() => {
    const found = [];
    const recaptchaDiv = document.querySelector(".g-recaptcha[data-sitekey]");
    if (recaptchaDiv) found.push({ type: "recaptcha_v2", siteKey: recaptchaDiv.getAttribute("data-sitekey") });
    const recaptchaIframe = document.querySelector('iframe[src*="recaptcha/api2/anchor"], iframe[src*="recaptcha/"]');
    if (recaptchaIframe && found.length === 0) {
      const src = recaptchaIframe.getAttribute("src") || "";
      const match = src.match(/[?&]k=([^&]+)/);
      if (match) found.push({ type: "recaptcha_v2", siteKey: match[1] });
    }
    const hcaptchaDiv = document.querySelector(".h-captcha[data-sitekey]");
    if (hcaptchaDiv) found.push({ type: "hcaptcha", siteKey: hcaptchaDiv.getAttribute("data-sitekey") });
    const hcaptchaIframe = document.querySelector('iframe[src*="hcaptcha.com"]');
    if (hcaptchaIframe && found.length === 0) {
      const src = hcaptchaIframe.getAttribute("src") || "";
      const match = src.match(/[?&]sitekey=([^&]+)/);
      if (match) found.push({ type: "hcaptcha", siteKey: match[1] });
    }
    const turnstileDiv = document.querySelector(".cf-turnstile[data-sitekey]");
    if (turnstileDiv) found.push({ type: "turnstile", siteKey: turnstileDiv.getAttribute("data-sitekey") });
    return found;
  }).catch(() => []);

  if (detections.length === 0) return { detected: false, solved: false };

  const captcha = detections[0];
  try {
    const solveOptions = { ...solverConfig, type: captcha.type, siteKey: captcha.siteKey };
    const result = await solveCaptcha(page, solveOptions);
    if (captcha.type === "recaptcha_v2" && result.solved) {
      await page.evaluate(() => {
        const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      }).catch(() => {});
      await page.waitForTimeout(2000);
    }
    return { detected: true, solved: result.solved, type: captcha.type, token: result.token };
  } catch (e) {
    return { detected: true, solved: false, type: captcha.type, error: e.message };
  }
}

// ═══════════════════════════════════════════════
// CRAWL / PAGINATE
// ═══════════════════════════════════════════════

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

// ═══════════════════════════════════════════════
// ACTION EXECUTOR
// ═══════════════════════════════════════════════

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
    case "goto":
      await page.goto(value || selector, { waitUntil: options.waitUntil || "domcontentloaded", timeout: options.timeout || DEFAULT_TIMEOUT });
      // Auto-solve captcha if configured on the session
      if (session.captchaSolver) {
        const captchaResult = await autoSolveCaptcha(page, session.captchaSolver);
        result.captcha = captchaResult;
      }
      break;
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
    case "pdf": { const buffer = await page.pdf({ format: options.format || "A4", printBackground: true }); Object.assign(result, { base64: buffer.toString("base64"), mimeType: "application/pdf", size: buffer.length }); break; }
    case "solve_captcha": {
      const solveOpts = { ...options, apiKey: options.apiKey || session.captchaSolver?.apiKey, provider: options.provider || session.captchaSolver?.provider || "2captcha" };
      result.data = await solveCaptcha(page, solveOpts);
      break;
    }
    case "crawl": result.data = await crawl(page, options, policy); break;
    case "paginate": result.data = await paginate(page, options); break;
    case "get_cookies": result.data = await session.context.cookies(); break;
    case "set_cookies": await session.context.addCookies(normalizeCookies(options.cookies || [])); break;
    case "get_storage_state": result.data = await session.context.storageState(); break;
    case "set_storage_state": {
      if (options.storageState?.origins) {
        for (const origin of options.storageState.origins) {
          const verdict = await validateEgressUrl(origin.origin, policy);
          if (!verdict.ok) throw new Error(`Storage origin rejected: ${verdict.error}`);
          await page.goto(origin.origin, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
          for (const { name, key, value } of origin.localStorage || []) await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: name ?? key, v: value });
        }
      }
      break;
    }
    default: throw new Error(`Unknown action: ${action_type}`);
  }

  session.url = page.url();
  session.title = await page.title().catch(() => "");
  session.lastActivity = Date.now();
  session.status = "idle";
  return result;
}
