import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { user_id, type, title, body: notifBody, link, send_email = false } = body;

    if (!user_id || !title) return Response.json({ error: "user_id and title required" }, { status: 400 });

    // Create notification
    const notif = await base44.asServiceRole.entities.Notification.create({
      user_id,
      type: type || "system",
      title,
      body: notifBody || "",
      link: link || "",
      read: false,
      sent_email: false,
    });

    // Optionally send email
    if (send_email) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
        if (users[0]?.email) {
          await base44.integrations.Core.SendEmail({
            to: users[0].email,
            subject: title,
            body: notifBody || "",
          });
          await base44.asServiceRole.entities.Notification.update(notif.id, { sent_email: true });
        }
      } catch (e) { /* email may fail for unregistered users */ }
    }

    return Response.json({ success: true, notification_id: notif.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}