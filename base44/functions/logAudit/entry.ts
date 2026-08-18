import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json();
    const { action, entityType, entityId, description, metadata } = body;

    const log = await base44.entities.AuditLog.create({
      user_id: user?.id,
      user_email: user?.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description: description || "",
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    });

    return Response.json({ log });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}