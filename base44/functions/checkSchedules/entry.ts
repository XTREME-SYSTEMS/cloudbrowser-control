import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// Basic 5-field cron matcher: checks if a given UTC Date matches the cron expression
function cronMatch(date, expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const fields = [
    { val: date.getUTCMinutes(), expr: parts[0], min: 0, max: 59 },
    { val: date.getUTCHours(), expr: parts[1], min: 0, max: 23 },
    { val: date.getUTCDate(), expr: parts[2], min: 1, max: 31 },
    { val: date.getUTCMonth() + 1, expr: parts[3], min: 1, max: 12 },
    { val: date.getUTCDay(), expr: parts[4], min: 0, max: 6 },
  ];
  for (const { val, expr: e } of fields) {
    if (e === "*") continue;
    let match = false;
    for (const part of e.split(",")) {
      if (part.startsWith("*/")) {
        const step = parseInt(part.slice(2));
        if (val % step === 0) match = true;
      } else if (part.includes("-")) {
        const [a, b] = part.split("-").map(Number);
        if (val >= a && val <= b) match = true;
      } else {
        if (val === parseInt(part)) match = true;
      }
    }
    if (!match) return false;
  }
  return true;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const schedules = await base44.asServiceRole.entities.Schedule.filter({ enabled: true });
    const now = new Date();
    let ran = 0;

    for (const schedule of schedules) {
      let due = false;
      const lastRun = schedule.last_run ? new Date(schedule.last_run) : new Date(schedule.created_date);

      if (schedule.interval_seconds && schedule.interval_seconds > 0) {
        const elapsed = (now - lastRun) / 1000;
        if (elapsed >= schedule.interval_seconds) due = true;
      } else if (schedule.cron_expression) {
        const check = new Date(lastRun);
        check.setUTCSeconds(0, 0);
        for (let i = 0; i < 1440; i++) {
          check.setUTCMinutes(check.getUTCMinutes() + 1);
          if (check > now) break;
          if (cronMatch(check, schedule.cron_expression)) { due = true; break; }
        }
      }

      if (due) {
        try {
          await base44.asServiceRole.functions.invoke("runScheduledJob", { scheduleId: schedule.id });
          ran++;
        } catch (e) {
          console.error(`Schedule ${schedule.id} failed:`, e.message);
        }
      }
    }

    return Response.json({ ok: true, checked: schedules.length, ran });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}