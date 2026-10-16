import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Daily Heir Digest — queries today's heir search results and swarm agent
 * findings, formats a summary for the daily digest email.
 * Called only by the "Daily Heir Digest" workflow.
 */

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dateStr = now.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Today's heir search cases
    const heirRes = await base44.entities.HeirSearch.filter(
      { created_date: { $gte: todayStart } },
      { sort: "-created_date", limit: 100 }
    );
    const heirCases = (heirRes as any).items || heirRes;

    // Today's swarm agent tasks related to people/heir finding
    const swarmRes = await base44.entities.SwarmTask.filter(
      { created_date: { $gte: todayStart }, task_type: { $in: ["people_search", "full_trace", "data_enrichment"] }, status: "completed" },
      { sort: "-created_date", limit: 50 }
    );
    const swarmTasks = (swarmRes as any).items || swarmRes;

    // Aggregate stats
    const totalHeirs = heirCases.reduce((n: number, c: any) => n + (c.identified_heirs?.length || 0), 0);
    const livingHeirs = heirCases.reduce((n: number, c: any) =>
      n + (c.identified_heirs?.filter((h: any) => h.is_living)?.length || 0), 0);
    const confirmed = heirCases.filter((c: any) => c.deceased_confirmed).length;

    // Format case sections as HTML for the email
    const caseSections = heirCases.map((c: any) => {
      const heirs = c.identified_heirs || [];
      const statusColor = c.status === 'found' ? '#16a34a' : c.status === 'partial' ? '#d97706' : '#dc2626';
      const heirRows = heirs.slice(0, 10).map((h: any) => {
        const phones = (h.phone_numbers || []).map((p: any) => p.number).join(', ') || '—';
        const emails = (h.emails || []).map((e: any) => e.email).join(', ') || '—';
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${h.name || '—'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${h.relationship || '—'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:${h.is_living ? '#16a34a' : '#dc2626'};">${h.is_living ? 'Living' : 'Deceased'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${phones}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${emails}</td>
        </tr>`;
      }).join("");

      return `
      <div style="margin:0 0 24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:6px;background:#ffffff;">
        <h3 style="margin:0 0 4px 0;font-size:16px;color:#0a0a0a;">${c.deceased_name || 'Unknown'}</h3>
        <p style="margin:0 0 12px 0;font-size:13px;color:#737373;">
          ${c.case_reference ? `Ref: ${c.case_reference} — ` : ''}${c.deceased_dod || 'DOD unknown'} —
          <span style="color:${statusColor};font-weight:bold;">${(c.status || '').toUpperCase()}</span> —
          Confidence: ${c.confidence_score || 0}%
        </p>
        ${heirs.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#737373;border-bottom:2px solid #e5e7eb;">Heir</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#737373;border-bottom:2px solid #e5e7eb;">Relationship</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#737373;border-bottom:2px solid #e5e7eb;">Status</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#737373;border-bottom:2px solid #e5e7eb;">Phones</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#737373;border-bottom:2px solid #e5e7eb;">Emails</th>
            </tr>
          </thead>
          <tbody>${heirRows}</tbody>
        </table>
        ${heirs.length > 10 ? `<p style="margin:8px 0 0 0;font-size:12px;color:#737373;">+ ${heirs.length - 10} more heirs — view the full case in CloudBrowser</p>` : ''}
        ` : `<p style="margin:0;font-size:13px;color:#737373;">No heirs identified yet.</p>`}
      </div>`;
    }).join("");

    // Swarm agent findings section
    const swarmSection = swarmTasks.length > 0 ? `
      <div style="margin:0 0 24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:6px;background:#ffffff;">
        <h3 style="margin:0 0 8px 0;font-size:16px;color:#0a0a0a;">Agent Activity (${swarmTasks.length} tasks completed)</h3>
        ${swarmTasks.slice(0, 5).map((t: any) => `
          <p style="margin:0 0 6px 0;font-size:13px;color:#0a0a0a;">
            <strong>${t.agent_name || 'agent'}</strong> — ${t.task_type || 'task'}: ${t.result_summary || 'completed'}
          </p>`).join('')}
        ${swarmTasks.length > 5 ? `<p style="margin:8px 0 0 0;font-size:12px;color:#737373;">+ ${swarmTasks.length - 5} more tasks</p>` : ''}
      </div>` : "";

    const hasCases = heirCases.length > 0 || swarmTasks.length > 0;

    return Response.json({
      ok: true,
      date: dateStr,
      recipient_email: user.email,
      total_cases: heirCases.length,
      total_heirs: totalHeirs,
      living_heirs: livingHeirs,
      confirmed_cases: confirmed,
      agent_tasks: swarmTasks.length,
      cases_html: caseSections,
      swarm_html: swarmSection,
      has_cases: hasCases,
    });
  } catch (error: any) {
    console.error("Daily heir digest error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}