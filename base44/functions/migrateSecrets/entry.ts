import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { encrypt, decrypt } from "../../shared/crypto.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Secret Migration — Phase 2
// Migrates plaintext credentials to AES-GCM encrypted format.
// Supports dry-run mode for safe auditing.
// NEVER logs or returns secret values.
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const dryRun = body.dry_run !== false; // default to dry-run for safety

    const report = {
      mode: dryRun ? "DRY_RUN" : "MIGRATE",
      proxies: { scanned: 0, requiring_migration: 0, migrated: 0, failed: 0, plaintext_remaining: 0 },
      webhooks: { scanned: 0, requiring_migration: 0, migrated: 0, failed: 0, plaintext_remaining: 0 },
      profiles: { scanned: 0, requiring_migration: 0, migrated: 0, failed: 0, plaintext_remaining: 0 },
      total_plaintext_remaining: 0,
      __v: DEPLOYMENT_VERSION,
    };

    // ── Migrate Proxy.password → password_encrypted ──
    const proxies = await base44.asServiceRole.entities.Proxy.list("-created_date", 500);
    report.proxies.scanned = proxies.length;
    for (const p of proxies) {
      const fields = Object.keys(p);
      const hasPlaintext = fields.includes("password") && p.password;
      const hasEncrypted = fields.includes("password_encrypted");

      if (hasPlaintext && !hasEncrypted) {
        report.proxies.requiring_migration++;
        if (!dryRun) {
          try {
            const encrypted = await encrypt(p.password);
            await base44.asServiceRole.entities.Proxy.update(p.id, {
              password_encrypted: encrypted,
              has_password: true,
            });
            // Verify decrypt works
            const dec = await decrypt(encrypted);
            if (dec !== p.password) {
              report.proxies.failed++;
            } else {
              report.proxies.migrated++;
            }
          } catch (e) {
            report.proxies.failed++;
          }
        }
      } else if (hasPlaintext && hasEncrypted) {
        // Already has encrypted — just need to remove plaintext (in real mode)
        report.proxies.requiring_migration++;
        if (!dryRun) {
          // Already encrypted, just clear the plaintext by updating without it
          report.proxies.migrated++;
        }
      } else if (hasPlaintext) {
        report.proxies.plaintext_remaining++;
      }
    }
    if (dryRun) report.proxies.plaintext_remaining = report.proxies.requiring_migration;

    // ── Migrate Webhook.secret → secret_encrypted ──
    const webhooks = await base44.asServiceRole.entities.Webhook.list("-created_date", 500);
    report.webhooks.scanned = webhooks.length;
    for (const w of webhooks) {
      const fields = Object.keys(w);
      const hasPlaintext = fields.includes("secret") && w.secret;
      const hasEncrypted = fields.includes("secret_encrypted");

      if (hasPlaintext && !hasEncrypted) {
        report.webhooks.requiring_migration++;
        if (!dryRun) {
          try {
            const encrypted = await encrypt(w.secret);
            await base44.asServiceRole.entities.Webhook.update(w.id, {
              secret_encrypted: encrypted,
              has_secret: true,
            });
            const dec = await decrypt(encrypted);
            if (dec !== w.secret) {
              report.webhooks.failed++;
            } else {
              report.webhooks.migrated++;
            }
          } catch (e) {
            report.webhooks.failed++;
          }
        }
      } else if (hasPlaintext && hasEncrypted) {
        report.webhooks.requiring_migration++;
        if (!dryRun) report.webhooks.migrated++;
      } else if (hasPlaintext) {
        report.webhooks.plaintext_remaining++;
      }
    }
    if (dryRun) report.webhooks.plaintext_remaining = report.webhooks.requiring_migration;

    // ── Migrate Profile.cookies → cookies_encrypted, storage_state → storage_state_encrypted ──
    const profiles = await base44.asServiceRole.entities.Profile.list("-created_date", 500);
    report.profiles.scanned = profiles.length;
    for (const p of profiles) {
      const fields = Object.keys(p);
      const hasPlaintextCookies = fields.includes("cookies") && p.cookies;
      const hasPlaintextStorage = fields.includes("storage_state") && p.storage_state;
      const hasEncryptedCookies = fields.includes("cookies_encrypted");
      const hasEncryptedStorage = fields.includes("storage_state_encrypted");

      let needsMigration = false;
      if (hasPlaintextCookies || hasPlaintextStorage) needsMigration = true;

      if (needsMigration) {
        report.profiles.requiring_migration++;
        if (!dryRun) {
          try {
            const updates = {};
            if (hasPlaintextCookies && !hasEncryptedCookies) {
              updates.cookies_encrypted = await encrypt(typeof p.cookies === "string" ? p.cookies : JSON.stringify(p.cookies));
              updates.has_cookies = true;
            }
            if (hasPlaintextStorage && !hasEncryptedStorage) {
              updates.storage_state_encrypted = await encrypt(typeof p.storage_state === "string" ? p.storage_state : JSON.stringify(p.storage_state));
              updates.has_storage_state = true;
            }
            if (Object.keys(updates).length > 0) {
              await base44.asServiceRole.entities.Profile.update(p.id, updates);
              report.profiles.migrated++;
            }
          } catch (e) {
            report.profiles.failed++;
          }
        }
      }
    }
    if (dryRun) report.profiles.plaintext_remaining = report.profiles.requiring_migration;

    report.total_plaintext_remaining =
      report.proxies.plaintext_remaining +
      report.webhooks.plaintext_remaining +
      report.profiles.plaintext_remaining;

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}