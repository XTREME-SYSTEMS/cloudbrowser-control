export async function logAudit(base44, user, action, entityType, entityId, description, metadata = {}) {
  try {
    await base44.entities.AuditLog.create({
      user_id: user?.id,
      user_email: user?.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Audit log failed:", e.message);
  }
}