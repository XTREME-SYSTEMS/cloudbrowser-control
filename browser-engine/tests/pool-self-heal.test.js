/**
 * Contract tests for the engine's self-healing browser pool.
 *
 * These assert the behaviours that were missing when the primary engine failed
 * intermittently: a half-built browser is closed rather than leaked, a dead
 * pooled session is never handed out, failures are counted and backed off, and
 * the engine asks to be recreated only when it truly cannot serve.
 *
 * They import only node: builtins and the healer module, so they run with no
 * dependencies installed and no browser present.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createPoolHealer } from "../pool-healer.js";

function fakePage() {
  let closed = false;
  return { isClosed: () => closed, close: async () => { closed = true; } };
}

function fakeBrowser(page) {
  const browser = {
    closed: false,
    isConnected: () => !browser.closed,
    close: async () => { browser.closed = true; },
    newContext: async () => ({
      addInitScript: async () => {},
      newPage: async () => page,
      close: async () => {},
    }),
  };
  return browser;
}

/** A browser that launches fine but cannot produce a page — the EAGAIN shape. */
function browserThatFailsSetup() {
  const browser = fakeBrowser(fakePage());
  browser.newContext = async () => ({
    addInitScript: async () => {},
    newPage: async () => { throw new Error("spawn /root/.cache/ms-playwright/chrome-headless-shell EAGAIN"); },
    close: async () => {},
  });
  return browser;
}

function harness({ launch, config = {}, poolSize = 2, maxSessions = 10, trackSession } = {}) {
  const sessions = new Map();
  const pool = [];
  const clock = { t: 1_000_000 };
  const exits = [];
  const logs = [];
  const closed = [];
  const made = [];
  let seq = 0;

  const healer = createPoolHealer({
    chromium: { launch: async (opts) => { const b = await launch(opts); made.push(b); return b; } },
    sessions,
    pool,
    closeSession: async (id, reason) => {
      closed.push({ id, reason });
      const s = sessions.get(id);
      if (s) {
        try { await s.context?.close(); } catch (e) { /* best effort */ }
        try { await s.browser?.close(); } catch (e) { /* best effort */ }
      }
      sessions.delete(id);
      const i = pool.indexOf(id);
      if (i >= 0) pool.splice(i, 1);
      return true;
    },
    poolSize,
    maxSessions,
    uid: () => `sess_${++seq}`,
    buildStealthScript: () => "",
    trackSession: trackSession || (async () => {}),
    config,
    exit: (code) => exits.push(code),
    logger: { error: (m) => logs.push(m), warn: (m) => logs.push(m), log: (m) => logs.push(m) },
    now: () => clock.t,
  });

  return { healer, sessions, pool, clock, exits, logs, closed, made };
}

test("a browser that fails setup is closed, not leaked", async () => {
  const browser = browserThatFailsSetup();
  const { healer, pool, logs } = harness({ launch: async () => browser });
  await healer.warmPool();

  assert.equal(browser.closed, true, "the half-built browser must be closed");
  assert.equal(pool.length, 0, "it must not enter the pool");
  assert.equal(healer.state.consecutive_launch_failures, 1);
  assert.match(healer.state.last_launch_error, /EAGAIN/);
  assert.ok(logs.some((l) => l.includes("EAGAIN")), "the failure must be logged, never swallowed");
});

test("a failing warm-up backs off instead of retrying every cycle", async () => {
  let attempts = 0;
  let fail = true;
  const { healer, pool, clock } = harness({
    launch: async () => { attempts++; return fail ? browserThatFailsSetup() : fakeBrowser(fakePage()); },
    config: { warmBackoffBaseMs: 15000, warmBackoffMaxMs: 300000 },
  });

  await healer.warmPool();
  assert.equal(attempts, 1, "one attempt per warm-up cycle, not a spin loop");
  assert.equal(healer.state.consecutive_launch_failures, 1);

  await healer.warmPool();
  assert.equal(attempts, 1, "still inside the backoff window — no hammering");

  clock.t += 60000;
  fail = false;
  await healer.warmPool();
  assert.equal(attempts, 3, "retries once the backoff has elapsed, then refills both slots (1 failed + 2 successful)");
  assert.equal(pool.length, 2, "and the pool refills");
  assert.equal(healer.state.consecutive_launch_failures, 0, "one success clears the streak");
  assert.ok(healer.state.last_launch_success_at);
});

test("a healthy warm-up fills the pool", async () => {
  const { healer, pool, sessions } = harness({ launch: async () => fakeBrowser(fakePage()) });
  await healer.warmPool();
  assert.equal(pool.length, 2);
  assert.equal(sessions.size, 2);
  assert.equal(healer.state.consecutive_launch_failures, 0);
});

test("a failed session registration keeps usable capacity instead of leaking a browser", async () => {
  const { healer, pool, sessions } = harness({
    launch: async () => fakeBrowser(fakePage()),
    poolSize: 1,
    trackSession: async () => { throw new Error("session store unreachable"); },
  });
  await healer.warmPool();

  assert.equal(pool.length, 1, "the session is still warm capacity");
  assert.equal(sessions.size, 1);
  assert.equal(healer.state.consecutive_launch_failures, 0, "registration is not a launch failure");
});

test("a pooled session whose browser has died is dropped, never handed out", async () => {
  const { healer, pool, sessions, made } = harness({ launch: async () => fakeBrowser(fakePage()) });
  await healer.warmPool();
  assert.equal(pool.length, 2);

  made[0].closed = true; // the browser process died but stayed in the pool

  assert.equal(healer.isUsable(sessions.get(pool[0])), false, "a dead handle is not usable");
  assert.equal(healer.reapDeadPooledSessions(), 1);
  assert.equal(pool.length, 1, "capacity now reflects reality");
  assert.equal(sessions.size, 1);
  assert.equal(healer.state.dead_pooled_dropped, 1);
});

test("a session whose page has closed is not usable", async () => {
  const page = fakePage();
  const { healer } = harness({ launch: async () => fakeBrowser(page) });
  const session = { browser: fakeBrowser(page), context: {}, page };

  assert.equal(healer.isUsable(session), true);
  await page.close();
  assert.equal(healer.isUsable(session), false);
});

test("the engine asks to be recreated only when nothing can launch and no warm capacity remains", async () => {
  const { healer, exits, clock } = harness({
    launch: async () => browserThatFailsSetup(),
    config: { launchFailureExitThreshold: 2, warmBackoffBaseMs: 1, warmBackoffMaxMs: 1 },
  });

  await healer.warmPool();
  assert.deepEqual(exits, [], "one failure is not an outage");

  clock.t += 10;
  await healer.warmPool();
  assert.deepEqual(exits, [1], "with no warm capacity left it asks for a fresh container");
});

test("a failure never kills live sessions while warm capacity remains", async () => {
  let n = 0;
  const { healer, exits } = harness({
    launch: async () => (++n === 1 ? fakeBrowser(fakePage()) : browserThatFailsSetup()),
    config: { launchFailureExitThreshold: 1, warmBackoffBaseMs: 1, warmBackoffMaxMs: 1 },
  });

  await healer.warmPool();
  assert.equal(healer.state.consecutive_launch_failures, 1, "the failure was recorded");
  assert.deepEqual(exits, [], "live sessions are never killed to fix one failed launch");
});

test("the self-heal kill switch disables the self-restart", async () => {
  const { healer, exits, clock } = harness({
    launch: async () => browserThatFailsSetup(),
    config: { selfHealEnabled: false, launchFailureExitThreshold: 1, warmBackoffBaseMs: 1, warmBackoffMaxMs: 1 },
  });

  await healer.warmPool();
  clock.t += 10;
  await healer.warmPool();
  assert.deepEqual(exits, [], "SELF_HEAL_ENABLED=false keeps the process alive");
  assert.equal(healer.state.consecutive_launch_failures, 2, "but failures are still recorded");
});

test("recycling drains the pool and warms a fresh one", async () => {
  const { healer, pool, sessions, closed } = harness({ launch: async () => fakeBrowser(fakePage()) });
  await healer.warmPool();
  assert.equal(pool.length, 2);

  const result = await healer.recyclePool();
  assert.equal(result.recycles, 1);
  assert.equal(result.pool_size, 2, "the pool is warm again");
  assert.equal(result.pool_capacity, 2);
  assert.equal(closed.filter((c) => c.reason === "recycled").length, 2, "the old browsers were closed");
  assert.equal(sessions.size, 2, "no stale sessions were left behind");
});