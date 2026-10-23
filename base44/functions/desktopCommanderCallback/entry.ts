import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { encrypt, decrypt } from '../../shared/crypto.ts';
import { listMcpTools } from '../../shared/mcpClient.ts';
import { exchangeCode, expiryFrom, MCP_ENDPOINT } from '../../shared/desktopCommanderAuth.ts';

// The one-time pairing callback. The operator's browser lands here after
// approving the device in Desktop Commander, carrying a single-use code.
//
// Reached without a session, so the pairing is only completed when the state it
// returns matches the state stored when the pairing started. The state is then
// cleared, so a replayed callback cannot pair twice.

function page(title, message, tone) {
  const accent = tone === 'ok' ? '#0a1f3c' : '#8a1c1c';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="margin:0;background:#ffffff;font-family:Inter,Helvetica,Arial,sans-serif;color:#0a1f3c;">
<div style="max-width:560px;margin:12vh auto;padding:0 24px;">
<div style="background:#0a1f3d;color:#ffffff;padding:20px 24px;border-radius:8px 8px 0 0;font-family:'Playfair Display',Georgia,serif;font-size:18px;font-weight:700;">CloudBrowser</div>
<div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:28px 24px;background:#faf8f3;">
<h1 style="margin:0 0 12px;font-size:20px;color:${accent};">${title}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">${message}</p>
<a href="/" style="display:inline-block;background:#0a1f3d;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Back to CloudBrowser</a>
</div></div></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function fail(message) {
  return page('Pairing did not complete', message, 'error');
}

export default async function (req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const denied = url.searchParams.get('error');

    if (denied) return fail(`The device service declined the request (${denied}).`);
    if (!code || !state) return fail('This link is missing its pairing code, or it has already been used.');

    const base44 = createClientFromRequest(req);
    const service = base44.asServiceRole.entities;

    const matched = await service.DesktopConnection.filter({ pending_state: state }, { limit: 1 });
    const connection = matched.items?.[0];
    if (!connection) return fail('This pairing link is no longer valid. Start the pairing again from the app.');

    const verifier = await decrypt(connection.pending_verifier_enc);
    if (!verifier) return fail('The pairing details for this link were lost. Start the pairing again from the app.');

    const tokens = await exchangeCode({
      code,
      verifier,
      clientId: connection.client_id,
      clientSecret: await decrypt(connection.client_secret_enc),
      callbackUrl: `${url.origin}/functions/desktopCommanderCallback`,
    });

    if (!tokens?.access_token) return fail('The device service did not return an access token. Start the pairing again.');

    await service.DesktopConnection.update(connection.id, {
      access_token_enc: await encrypt(tokens.access_token),
      refresh_token_enc: tokens.refresh_token ? await encrypt(tokens.refresh_token) : connection.refresh_token_enc,
      expires_at: expiryFrom(tokens),
      pending_state: '',
      pending_verifier_enc: '',
      status: 'connected',
      connected_at: new Date().toISOString(),
      last_error: '',
    });

    // Reach the machine once now, so a pairing that cannot actually reach the
    // device is reported here rather than discovered later by the agent.
    try {
      const tools = await listMcpTools(MCP_ENDPOINT, tokens.access_token);
      await service.DesktopConnection.update(connection.id, {
        tools,
        tool_count: tools.length,
      });
      return page(
        'Your computer is connected',
        `The agent can now reach this machine — ${tools.length} tool${tools.length === 1 ? '' : 's'} available. Close this tab and return to the app.`,
        'ok'
      );
    } catch (error) {
      await service.DesktopConnection.update(connection.id, { last_error: error.message });
      return page(
        'Paired, but the machine did not answer',
        `The pairing was saved, but the device could not be reached yet (${error.message}). Close this tab and check it from the app.`,
        'error'
      );
    }
  } catch (error) {
    console.error('desktopCommanderCallback failed:', error.message);
    return fail(`The pairing could not be completed (${error.message}).`);
  }
}