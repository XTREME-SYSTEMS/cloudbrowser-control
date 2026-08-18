import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { prompt } = body;
    if (!prompt) return Response.json({ error: "prompt required" }, { status: 400 });

    const systemPrompt = `You are a browser automation expert. Convert the user's natural language request into a JSON array of browser automation steps.

Each step has: action_type, selector (CSS selector if needed), value (text/URL if needed), name (short label), options (object).

Valid action_types: goto, click, type, fill, press, select_option, scroll, screenshot, wait_for_selector, wait_for_timeout, extract_text, extract_html, extract_table, extract_attribute, extract_json, ai_extract, pdf, hover, reload, new_tab, switch_tab, close_tab, evaluate, paginate, crawl, upload_file, download, set_cookies, set_headers.

Return ONLY a JSON array, no explanation. Example:
[{"action_type":"goto","value":"https://example.com","name":"Navigate to page"},{"action_type":"wait_for_selector","selector":".product-list","name":"Wait for products"},{"action_type":"extract_text","selector":".price","name":"Extract prices"}]`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\nUser request: ${prompt}`,
      response_json_schema: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action_type: { type: "string" },
                selector: { type: "string" },
                value: { type: "string" },
                name: { type: "string" },
                options: { type: "object" },
              },
            },
          },
          job_name: { type: "string" },
          start_url: { type: "string" },
        },
      },
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}