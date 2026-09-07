import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CLIENT_CONFIGS = {
  chatgpt: {
    label: 'ChatGPT / OpenAI',
    format: 'url',
    instructions: 'Add this URL to your ChatGPT custom connector settings:',
  },
  claude: {
    label: 'Claude / Anthropic',
    format: 'json',
    instructions: 'Add this to your Claude Desktop config file (claude_desktop_config.json):',
  },
  gemini: {
    label: 'Gemini / Google',
    format: 'url',
    instructions: 'Add this URL to your Gemini extensions settings:',
  },
  cursor: {
    label: 'Cursor IDE',
    format: 'json',
    instructions: 'Add this to your Cursor MCP settings:',
  },
  windsurf: {
    label: 'Windsurf',
    format: 'json',
    instructions: 'Add this to your Windsurf MCP config:',
  },
  generic: {
    label: 'Generic MCP Client',
    format: 'json',
    instructions: 'Use this config in any MCP-compatible client:',
  },
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, target_client = 'generic', scopes = ['sessions:read', 'sessions:write', 'scrape:run'] } = body;

    // Create or reuse an API key for this MCP config
    let apiKey = body.api_key;
    if (!apiKey) {
      const keyRes = await base44.functions.invoke('createApiKey', {
        name: `MCP: ${name}`,
        scopes,
      });
      apiKey = keyRes.data?.api_key || keyRes.api_key;
    }

    // Build the MCP server URL
    const origin = 'https://cloud-browser.base44.app';
    const mcpUrl = `${origin}/functions/mcpTools`;

    const clientConfig = CLIENT_CONFIGS[target_client] || CLIENT_CONFIGS.generic;

    // Generate the appropriate config format
    let configJson;
    if (clientConfig.format === 'url') {
      configJson = JSON.stringify({
        mcpServers: {
          cloudbrowser: {
            url: `${mcpUrl}?apiKey=${apiKey}`,
          },
        },
      }, null, 2);
    } else {
      configJson = JSON.stringify({
        mcpServers: {
          cloudbrowser: {
            command: 'npx',
            args: ['-y', 'mcp-remote', `${mcpUrl}?apiKey=${apiKey}`],
          },
        },
      }, null, 2);
    }

    // Save the MCP config
    const mcpRecord = await base44.entities.McpConfig.create({
      name,
      target_client,
      config_json: configJson,
      mcp_url: mcpUrl,
      scopes,
      status: 'active',
    });

    // Link the API key if we created one
    if (apiKey) {
      const keys = await base44.entities.ApiKey.filter({ name: `MCP: ${name}` }).catch(() => []);
      if (keys.length > 0) {
        await base44.entities.McpConfig.update(mcpRecord.id, { api_key_id: keys[0].id });
      }
    }

    return Response.json({
      success: true,
      mcp_config_id: mcpRecord.id,
      mcp_url: mcpUrl,
      api_key: apiKey,
      config_json: configJson,
      client_label: clientConfig.label,
      instructions: clientConfig.instructions,
      scopes,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}