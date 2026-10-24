import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { encrypt } from '../../shared/crypto.ts';
import { listMcpTools, callMcpTool } from '../../shared/mcpClient.ts';
import {
  MCP_ENDPOINT,
  OAUTH_SCOPE,
  createPkce,
  createState,
  registerClient,
  buildAuthorizeUrl,
} from '../../shared/desktopCommanderAuth.ts';
// The grant handling moved to a shared module so the OpenClaw cycle can reach the
// same paired machine without a second copy of it.
import {
  currentConnection,
  publicView,
  liveAccessToken,
} from '../../shared/desktopCommanderBridge.ts';

// The bridge from this app's agent to the operator's own computer, through the
// Desktop Commander remote MCP endpoint. The agent calls this function and the
// call lands as a real command on the paired machine.
//
// Actions: status | connect | disconnect | tools | call
// Admin-only: this reaches a private machine and holds its credentials.

const CALLBACK_FUNCTION = 'desktopCommanderCallback';

function originFor(req) {
  const origin = req.headers.get('x-base44-app-url');
  if (!origin) {
    throw new Error(
      'The app URL is unavailable, so the pairing link cannot be built. Open the app at its published address and try again.'
    );
  }
  return origin.replace(/\/+$/, '');
}

function callbackUrlFor(req) {
  return `${originFor(req)}/functions/${CALLBACK_FUNCTION}`;
}

async function startPairing(base44, req) {
  const callbackUrl = callbackUrlFor(req);
  const client = await registerClient(callbackUrl);
  if (!client?.client_id) throw new Error('The device service did not return a client id.');

  const { verifier, challenge } = await createPkce();
  const state = createState();
  const fields = {
    client_id: client.client_id,
    client_secret_enc: client.client_secret ? await encrypt(client.client_secret) : '',
    pending_state: state,
    pending_verifier_enc: await encrypt(verifier),
    scopes: OAUTH_SCOPE,
    status: 'pending',
    last_error: '',
  };

  const existing = await currentConnection(base44);
  const saved = existing
    ? await base44.entities.DesktopConnection.update(existing.id, fields)
    : await base44.entities.DesktopConnection.create(fields);

  return {
    connection_id: saved.id,
    authorize_url: buildAuthorizeUrl({
      clientId: client.client_id,
      callbackUrl,
      state,
      challenge,
    }),
    note: 'Open the pairing link and approve it on the device. This page can be checked again once it is done.',
  };
}

async function refreshTools(base44, connection) {
  const token = await liveAccessToken(base44, connection);
  const tools = await listMcpTools(MCP_ENDPOINT, token);
  await base44.entities.DesktopConnection.update(connection.id, {
    tools,
    tool_count: tools.length,
    last_used_at: new Date().toISOString(),
    last_error: '',
    status: 'connected',
  });
  return tools;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body = {};
    try {
      body = await req.json();
    } catch {
      // An empty body falls through to the status action.
    }
    const action = body.action || 'status';

    if (action === 'status') {
      return Response.json(publicView(await currentConnection(base44)));
    }

    if (action === 'connect') {
      return Response.json(await startPairing(base44, req));
    }

    if (action === 'disconnect') {
      const existing = await currentConnection(base44);
      if (existing) await base44.entities.DesktopConnection.delete(existing.id);
      return Response.json({ connected: false, status: 'none', tools: [], tool_count: 0 });
    }

    const connection = await currentConnection(base44);
    if (!connection || connection.status === 'pending') {
      return Response.json(
        { error: 'No device is paired yet. Pair one first.', needs_pairing: true },
        { status: 409 }
      );
    }

    if (action === 'tools') {
      const tools = await refreshTools(base44, connection);
      return Response.json({ tool_count: tools.length, tools });
    }

    if (action === 'call') {
      const { tool, args } = body;
      if (!tool) return Response.json({ error: 'A tool name is required.' }, { status: 400 });
      const token = await liveAccessToken(base44, connection);
      const result = await callMcpTool(MCP_ENDPOINT, token, tool, args);
      await base44.entities.DesktopConnection.update(connection.id, {
        last_used_at: new Date().toISOString(),
        last_error: '',
      });
      return Response.json({
        ok: !result?.isError,
        tool,
        result: result?.content ?? result ?? null,
        is_error: Boolean(result?.isError),
      });
    }

    return Response.json({ error: `Unknown action "${action}".` }, { status: 400 });
  } catch (error) {
    console.error('desktopCommander failed:', error.message);
    return Response.json(
      { error: error.message, needs_reauth: Boolean(error.needsReauth) },
      { status: error.needsReauth ? 409 : 500 }
    );
  }
}