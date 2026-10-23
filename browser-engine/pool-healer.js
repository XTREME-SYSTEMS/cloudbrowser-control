/**
 * Self-healing browser pool for the Cloud Browser Engine.
 *
 * The pool used to fail silently in the worst possible way: `chromium.launch`
 * succeeded, a later setup step threw, the browser was never closed, and
 * `catch (e) { break; }` discarded the error without leaving a trace. Every
 * re-warm leaked another Chromium process until the container could spawn none
 * at all ("spawn … EAGAIN") — while /health kept answering "healthy" and only
 * the unlucky caller saw the failure.
 *
 * This module makes the engine's failure behaviour explicit:
 *
 *   1. a browser that does not reach the pool is always closed;
 *   2. a pooled session whose browser has died is dropped, never handed out;
 *   3. failures are counted, logged and backed off instead of swallowed;
 *   4. once no browser can be started at all, the engine exits so its restart
 *      policy recreates the container. Leaked processes cannot be reclaimed
 *      from inside the container, so a fresh one is the only real cure.
 *
 * Everything the pool touches is injected, so the failure paths can be
 * exercised directly — see tests/pool-self-heal.test.js, which runs with no
 * browser and no dependencies installed.
 */

export function createPoolHealer({
  chromium,
  sessions,
  pool,
  closeSession,
  poolSize,
  maxSessions,
  uid,
  buildStealthScript,
  trackSession,
  config = {},
  exit = (code) => process.exit(code),
  logger = console,
  now = () => Date.now(),
}) {
  const selfHealEnabled = config.selfHealEnabled ?? (process.env.SELF_HEAL_ENABLED !== "false");
  const exitThreshold = config.launchFailureExitThreshold ?? parseInt(process.env.LAUNCH_FAILURE_EXIT_THRESHOLD || "6", 10);
  const backoffBaseMs = config.warmBackoffBaseMs ?? parseInt(process.env.WARM_BACKOFF_BASE_MS || "15000", 10);
  const backoffMaxMs = config.warmBackoffMaxMs ?? parseInt(process.env.WARM_BACKOFF_MAX_MS || "300000", 10);

  const state = {
    consecutive_launch_failures: 0,
    last_launch_error: null,
    last_launch_failure_at: null,
    last_launch_success_at: null,
    dead_pooled_dropped: 0,
    recycles: 0,
  };
  let nextWarmAttemptAt = 0;

  /** A pooled session is only usable while its browser is actually alive. */
  function isUsable(s) {
    try {
      return !!s && !!s.browser && s.browser.isConnected() && !!s.context && !!s.page && !s.page.isClosed();
    } catch (e) { return false; }
  }

  /**
   * Leaked processes cannot be reclaimed from inside the container, so once no
   * browser can be started at all, the only cure is a fresh container. Exiting
   * non-zero is what the Railway ON_FAILURE restart policy and docker's
   * `restart:` both act on — the engine heals itself with no external operator.
   */
  function recordLaunchFailure(e) {
    state.consecutive_launch_failures++;
    state.last_launch_error = String(e?.message || e).split("\n")[0];
    state.last_launch_failure_at = new Date(now()).toISOString();
    logger.error(`[self-heal] browser start failed (${state.consecutive_launch_failures} in a row): ${state.last_launch_error}`);
    if (!selfHealEnabled) return;
    if (state.consecutive_launch_failures < exitThreshold) return;
    if (pool.length > 0) return; // still has warm capacity — never kill live sessions
    logger.error(`[self-heal] ${state.consecutive_launch_failures} consecutive launch failures with an empty pool — exiting so the container is recreated`);
    exit(1);
  }

  /** Launch a browser, and never leave one behind if the setup that follows fails. */
  async function launchBrowser(args, onReady) {
    let browser = null;
    try {
      browser = await chromium.launch({ headless: true, args });
      const out = await onReady(browser);
      state.consecutive_launch_failures = 0;
      state.last_launch_success_at = new Date(now()).toISOString();
      return out;
    } catch (e) {
      try { await browser?.close(); } catch (closeErr) {}
      recordLaunchFailure(e);
      throw e;
    }
  }

  /** Drop pooled sessions whose browser has died, so a dead handle is never served. */
  function reapDeadPooledSessions() {
    let dropped = 0;
    for (let i = pool.length - 1; i >= 0; i--) {
      const s = sessions.get(pool[i]);
      if (!isUsable(s)) {
        pool.splice(i, 1);
        if (s) sessions.delete(s.id);
        dropped++;
      }
    }
    if (dropped) {
      state.dead_pooled_dropped += dropped;
      logger.warn(`[self-heal] dropped ${dropped} dead pooled session(s)`);
    }
    return dropped;
  }

  async function warmPool() {
    if (now() < nextWarmAttemptAt) return;
    reapDeadPooledSessions();
    while (pool.length < poolSize && sessions.size < maxSessions) {
      try {
        const id = uid();
        const session = {
          id, status: "pooled", url: "", title: "",
          lastActivity: now(), createdAt: now(), consoleLogs: [], networkLogs: [], isPooled: true,
        };
        await launchBrowser(
          ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
          async (browser) => {
            const context = await browser.newContext();
            await context.addInitScript(buildStealthScript("pool_" + Math.random().toString(36).slice(2)));
            const page = await context.newPage();
            Object.assign(session, { browser, context, page });
          }
        );
        sessions.set(id, session);
        pool.push(id);
        // Registration is bookkeeping, not capacity: if it fails the session is
        // still usable, so the pool keeps it rather than leaking a browser.
        try { await trackSession(id, session); }
        catch (trackErr) { logger.warn(`[pool] trackSession failed for ${id}: ${trackErr.message}`); }
      } catch (e) {
        // Back off so a container that cannot spawn is not hammered every cycle.
        const backoff = Math.min(backoffBaseMs * Math.pow(2, Math.max(0, state.consecutive_launch_failures - 1)), backoffMaxMs);
        nextWarmAttemptAt = now() + backoff;
        logger.warn(`[pool] warm-up paused for ${Math.round(backoff / 1000)}s`);
        break;
      }
    }
  }

  /** Drain the pool and re-warm it, so an operator or healer can ask for a rebuild. */
  async function recyclePool() {
    state.recycles++;
    while (pool.length > 0) await closeSession(pool.pop(), "recycled");
    nextWarmAttemptAt = 0;
    await warmPool();
    return { pool_size: pool.length, pool_capacity: poolSize, recycles: state.recycles };
  }

  /** Clear the backoff so a warm-up can be attempted immediately. */
  function resetBackoff() { nextWarmAttemptAt = 0; }

  return {
    state,
    isUsable,
    recordLaunchFailure,
    launchBrowser,
    reapDeadPooledSessions,
    warmPool,
    recyclePool,
    resetBackoff,
    nextWarmAttemptAt: () => nextWarmAttemptAt,
  };
}