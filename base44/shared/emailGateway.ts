// Email Gateway — Resend API replacement for base44.integrations.Core.SendEmail.
// Requires RESEND_API_KEY and optionally RESEND_FROM_EMAIL secrets.
// The from address must be a verified domain in your Resend account.
// For testing, the default onboarding@resend.dev works without domain verification.

const RESEND_API_URL = 'https://api.resend.com/emails';

function getResendKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set. Add it to app secrets to enable email sending via Resend.');
  return key;
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
}

interface EmailAttachment {
  filename: string;
  file_url?: string;
  content?: string;
}

export async function sendEmail(opts: {
  to: string;
  subject?: string;
  body?: string;
  html?: string;
  text?: string;
  from_name?: string;
  template_id?: string;
  template_name?: string;
  variables?: Record<string, any>;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; id?: string }> {
  const key = getResendKey();
  const fromEmail = getFromEmail();
  const from = opts.from_name ? `${opts.from_name} <${fromEmail}>` : fromEmail;

  const emailBody: any = { from, to: opts.to, subject: opts.subject || '' };

  if (opts.html) emailBody.html = opts.html;
  else if (opts.body) emailBody.html = opts.body;
  else if (opts.text) emailBody.text = opts.text;

  if (opts.attachments?.length) {
    emailBody.attachments = opts.attachments.map(a => ({
      filename: a.filename,
      ...(a.file_url ? { path: a.file_url } : {}),
      ...(a.content ? { content: a.content } : {}),
    }));
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emailBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend email error ${res.status}: ${errText}`);
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true, id: data.id };
}