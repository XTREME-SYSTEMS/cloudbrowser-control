export async function withRetry(fn, opts = {}) {
  const { retries = 3, baseDelay = 500, maxDelay = 5000 } = opts;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); } catch (e) {
      lastError = e;
      if (attempt < retries) { const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay); await new Promise(r => setTimeout(r, delay)); }
    }
  }
  throw lastError;
}
export function withTimeout(promise, ms, label = 'task') {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))]);
}
export async function recoverStuckTasks(base44, thresholdMs = 10 * 60 * 1000) {
  const cutoff = new Date(Date.now() - thresholdMs).toISOString();
  const stuck = await base44.asServiceRole.entities.AgentTask.filter({ status: 'in_progress', updated_date: { $lt: cutoff } }, { limit: 20 });
  let recovered = 0;
  for (const t of (stuck.items || [])) {
    try { await base44.asServiceRole.entities.AgentTask.update(t.id, { status: 'pending', result: `recovered_from_stuck at ${new Date().toISOString()}`.slice(0, 1000) }); recovered++; } catch (e) {}
  }
  return recovered;
}
export function createCircuitBreaker(threshold = 3) {
  let failures = 0; let tripped = false;
  return {
    recordSuccess: () => { failures = 0; tripped = false; },
    recordFailure: () => { failures++; if (failures >= threshold) tripped = true; },
    isTripped: () => tripped,
    failureCount: () => failures
  };
}
export async function sendGmailReport(base44, { to, subject, html, text }) {
  const conn = await base44.asServiceRole.connectors.getConnection('gmail');
  const accessToken = conn.accessToken;
  const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  const userInfoData = await userInfo.json();
  const fromEmail = userInfoData.email;
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const boundary = 'boundary_' + Math.random().toString(36).slice(2);
  const body = [
    `From: ${fromEmail}`, `To: ${to}`, `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', '', text,
    '', `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', '', html, '', `--${boundary}--`
  ].join('\r\n');
  const raw = btoa(unescape(encodeURIComponent(body))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw })
  });
  if (!response.ok) { const err = await response.text(); throw new Error(`Gmail API error: ${err}`); }
  return { sent: true, to };
}
export async function safeSendGmail(base44, breaker, emailOpts) {
  if (breaker.isTripped()) return { sent: false, skipped: true, reason: 'circuit_open' };
  try {
    const result = await sendGmailReport(base44, emailOpts);
    breaker.recordSuccess();
    return result;
  } catch (e) {
    breaker.recordFailure();
    return { sent: false, skipped: false, error: e.message };
  }
}