import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, payload } = body;

    const webhooks = await base44.asServiceRole.entities.Webhook.filter({ active: true });
    const matching = webhooks.filter((w) => w.events?.includes(event));

    let triggered = 0;
    let failed = 0;

    for (const webhook of matching) {
      const start = Date.now();
      try {
        // Format payload based on provider
        let requestBody;
        let headers = { "Content-Type": "application/json" };

        if (webhook.provider === "slack") {
          requestBody = JSON.stringify({
            text: `*${event}*`,
            blocks: [{ type: "section", text: { type: "mrkdwn", text: `*${event}*\n\`\`\`${JSON.stringify(payload, null, 2)}\`\`\`` } }],
          });
        } else if (webhook.provider === "discord") {
          requestBody = JSON.stringify({
            content: `**${event}**`,
            embeds: [{ title: event, description: JSON.stringify(payload).slice(0, 4000), color: 5814783 }],
          });
        } else {
          requestBody = JSON.stringify({ event, payload, timestamp: new Date().toISOString(), webhook: webhook.name });
        }

        const res = await fetch(webhook.url, { method: "POST", headers, body: requestBody });
        const responseText = await res.text();
        const duration = Date.now() - start;

        // Log delivery
        await base44.asServiceRole.entities.WebhookDelivery.create({
          webhook_id: webhook.id,
          event,
          payload: { event, data: payload },
          response_status: res.status,
          response_body: responseText.slice(0, 1000),
          attempts: 1,
          success: res.ok,
          duration_ms: duration,
        });

        await base44.asServiceRole.entities.Webhook.update(webhook.id, {
          last_triggered: new Date().toISOString(),
          last_status: res.status,
        });

        if (res.ok) triggered++; else failed++;
      } catch (e) {
        const duration = Date.now() - start;
        await base44.asServiceRole.entities.WebhookDelivery.create({
          webhook_id: webhook.id,
          event,
          payload: { event, data: payload },
          response_status: 0,
          response_body: e.message,
          attempts: 1,
          success: false,
          duration_ms: duration,
        });
        failed++;
      }
    }

    return Response.json({ triggered, failed, total: matching.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}