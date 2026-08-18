import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, payload } = body;

    const webhooks = await base44.entities.Webhook.filter({ active: true });
    const matching = webhooks.filter((w) => w.events?.includes(event));

    for (const webhook of matching) {
      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, payload, timestamp: new Date().toISOString(), webhook: webhook.name }),
        });
        await base44.entities.Webhook.update(webhook.id, {
          last_triggered: new Date().toISOString(),
          last_status: res.status,
        });
      } catch (e) {
        console.error(`Webhook ${webhook.id} failed:`, e.message);
      }
    }

    return Response.json({ triggered: matching.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}