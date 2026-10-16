import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

/**
 * Returns the Google Sheets tracking URL stored in HEIR_TRACKING_SHEET_URL secret.
 * Used by the Heir Search dashboard to show an "Open Tracking Sheet" link.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const url = secrets.get('HEIR_TRACKING_SHEET_URL') || '';
    return Response.json({ url });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}