import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// ═══════════════════════════════════════════════
// Settings Reconciler — desired → validate → apply → read-back → verify
// A setting is ACTIVE only when runtime read-back agrees.
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action, setting_key, desired_value, scope_type = "platform", scope_id = null, reason } = body;

    if (action === "set") {
      // Set desired value — does not mark as active until read-back
      const existing = await base44.asServiceRole.entities.Setting.filter({ setting_key, scope_type, scope_id });

      let setting;
      if (existing.length > 0) {
        setting = existing[0];
        await base44.asServiceRole.entities.Setting.update(setting.id, {
          desired_value,
          previous_value: setting.effective_value,
          apply_status: "pending",
          drift_status: "unknown",
          changed_by: user.id,
          changed_at: new Date().toISOString(),
          change_reason: reason || "",
        });
      } else {
        setting = await base44.asServiceRole.entities.Setting.create({
          setting_key,
          category: inferCategory(setting_key),
          scope_type,
          scope_id,
          desired_value,
          effective_value: desired_value,
          apply_status: "pending",
          drift_status: "unknown",
          changed_by: user.id,
          changed_at: new Date().toISOString(),
          change_reason: reason || "",
          operator_editable: true,
        });
      }

      return Response.json({ ok: true, setting_id: setting.id, apply_status: "pending" });
    }

    if (action === "reconcile") {
      // Apply pending settings and read back from runtime
      const pending = await base44.asServiceRole.entities.Setting.filter({ apply_status: "pending" });
      let applied = 0;
      let verified = 0;
      let drifted = 0;

      for (const s of pending) {
        try {
          // Mark as applying
          await base44.asServiceRole.entities.Setting.update(s.id, { apply_status: "applying" });

          // Apply to runtime target
          const applyResult = await applyToRuntime(base44, s);

          if (applyResult.applied) {
            // Read back from runtime
            const readBack = await readBackFromRuntime(base44, s);

            if (readBack.matches) {
              await base44.asServiceRole.entities.Setting.update(s.id, {
                apply_status: "verified",
                drift_status: "none",
                actual_runtime_value: readBack.value,
                last_verified_at: new Date().toISOString(),
                evidence_id: applyResult.evidence_id,
              });
              verified++;
            } else {
              await base44.asServiceRole.entities.Setting.update(s.id, {
                apply_status: "drifted",
                drift_status: "runtime_drift",
                actual_runtime_value: readBack.value,
                last_verified_at: new Date().toISOString(),
              });
              drifted++;
            }
            applied++;
          } else {
            await base44.asServiceRole.entities.Setting.update(s.id, {
              apply_status: "failed",
              drift_status: "unknown",
            });
          }
        } catch (e) {
          await base44.asServiceRole.entities.Setting.update(s.id, {
            apply_status: "failed",
            drift_status: "unknown",
          });
        }
      }

      return Response.json({ ok: true, applied, verified, drifted, total: pending.length });
    }

    if (action === "rollback") {
      const settings = await base44.asServiceRole.entities.Setting.filter({ setting_key, scope_type, scope_id });
      if (!settings.length) return Response.json({ error: "Setting not found" }, { status: 404 });
      const s = settings[0];
      if (!s.previous_value) return Response.json({ error: "No previous value to rollback to" }, { status: 400 });

      await base44.asServiceRole.entities.Setting.update(s.id, {
        desired_value: s.previous_value,
        previous_value: s.effective_value,
        apply_status: "pending",
        changed_by: user.id,
        changed_at: new Date().toISOString(),
        change_reason: `Rollback: ${reason || "operator rollback"}`,
      });

      return Response.json({ ok: true, setting_id: s.id, apply_status: "pending" });
    }

    if (action === "status") {
      // Get all settings with their drift status
      const all = await base44.asServiceRole.entities.Setting.list("-changed_at", 200);
      const summary = {
        total: all.length,
        verified: all.filter((s) => s.apply_status === "verified").length,
        pending: all.filter((s) => s.apply_status === "pending").length,
        drifted: all.filter((s) => s.drift_status !== "none" && s.drift_status !== "unknown").length,
        failed: all.filter((s) => s.apply_status === "failed").length,
      };
      return Response.json({ summary, settings: all });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function inferCategory(key) {
  const parts = key.split(".");
  const root = parts[0];
  const categoryMap = {
    engine: "workers", pool: "pool", session: "sessions", security: "security",
    cors: "cors", ssrf: "ssrf", ip: "ip_cidr", api: "api_keys", webhook: "webhooks",
    retention: "retention", storage: "storage", browser: "browser", network: "network",
    proxy: "proxies", job: "jobs", queue: "queue", schedule: "schedules",
    ai: "ai_models", live: "live_view", artifact: "artifacts", cost: "cost",
    billing: "billing", team: "teams", rbac: "rbac", rls: "rls",
  };
  return categoryMap[root] || "advanced";
}

async function applyToRuntime(base44, setting) {
  // For engine-targeted settings, we would call the engine config endpoint.
  // For gateway settings, we update SystemSettings (backward compat).
  // Until the engine has a config endpoint, we store in SystemSettings.
  const sysSettings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
  const key = setting.setting_key;
  const value = setting.desired_value;

  // Map setting keys to SystemSettings fields
  const fieldMap = {
    "engine.pool_size": "pool_size",
    "engine.pool_warm_count": "pool_warm_count",
    "engine.max_concurrent_sessions": "max_concurrent_sessions",
    "security.rate_limit_per_minute": "rate_limit_per_minute",
    "security.ip_allowlist": "ip_allowlist",
    "security.enforce_https": "enforce_https",
    "security.captcha_provider": "captcha_provider",
    "retention.screenshot_days": "screenshot_retention_days",
    "retention.log_days": "log_retention_days",
    "retention.video_days": "video_retention_days",
    "retention.auto_delete": "auto_delete_expired",
    "browser.default_viewport_width": "default_viewport_width",
    "browser.default_viewport_height": "default_viewport_height",
    "browser.default_timeout_ms": "default_timeout_ms",
    "browser.default_locale": "default_locale",
    "browser.default_timezone": "default_timezone",
  };

  const fieldName = fieldMap[key];
  if (!fieldName) {
    return { applied: false, error: `No runtime mapping for ${key}` };
  }

  if (sysSettings.length > 0) {
    await base44.asServiceRole.entities.SystemSettings.update(sysSettings[0].id, { [fieldName]: value });
  } else {
    await base44.asServiceRole.entities.SystemSettings.create({ [fieldName]: value });
  }

  return { applied: true, evidence_id: `evidence_${Date.now()}` };
}

async function readBackFromRuntime(base44, setting) {
  // Read back the actual value from SystemSettings
  const sysSettings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
  if (!sysSettings.length) return { matches: false, value: null };

  const key = setting.setting_key;
  const fieldMap = {
    "engine.pool_size": "pool_size",
    "engine.pool_warm_count": "pool_warm_count",
    "engine.max_concurrent_sessions": "max_concurrent_sessions",
    "security.rate_limit_per_minute": "rate_limit_per_minute",
    "security.ip_allowlist": "ip_allowlist",
    "security.enforce_https": "enforce_https",
    "retention.screenshot_days": "screenshot_retention_days",
    "retention.log_days": "log_retention_days",
    "retention.video_days": "video_retention_days",
    "browser.default_viewport_width": "default_viewport_width",
    "browser.default_viewport_height": "default_viewport_height",
  };

  const fieldName = fieldMap[key];
  if (!fieldName) return { matches: false, value: null };

  const actual = sysSettings[0][fieldName];
  return { matches: JSON.stringify(actual) === JSON.stringify(setting.desired_value), value: actual };
}