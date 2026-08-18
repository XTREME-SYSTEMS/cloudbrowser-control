import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { screenshot_id_1, screenshot_id_2 } = body;
    if (!screenshot_id_1 || !screenshot_id_2) return Response.json({ error: "Two screenshot IDs required" }, { status: 400 });

    const [s1, s2] = await Promise.all([
      base44.entities.Screenshot.get(screenshot_id_1),
      base44.entities.Screenshot.get(screenshot_id_2),
    ]);
    if (!s1 || !s2) return Response.json({ error: "Screenshot(s) not found" }, { status: 404 });

    // Use LLM to compare the two screenshots
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: "Compare these two screenshots and return a diff score from 0 (identical) to 100 (completely different), plus a summary of what changed.",
      file_urls: [s1.file_url, s2.file_url],
      response_json_schema: {
        type: "object",
        properties: {
          diff_score: { type: "number" },
          summary: { type: "string" },
          changes: { type: "array", items: { type: "string" } },
        },
      },
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}