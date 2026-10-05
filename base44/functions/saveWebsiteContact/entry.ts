import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { hashContactToken } from '../../shared/factoryAuth.ts';
export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Use POST.' }, { status: 405 });
    const raw = await req.text();
    if (raw.length > 8000) return Response.json({ error: 'Message too large.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (!/^[a-f0-9]{24}$/i.test(body.build_id || '') || typeof body.access_token !== 'string' || body.access_token.length > 200) return Response.json({ error: 'Unauthorized submission.' }, { status: 401 });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const build = await db.SystemBuild.get(body.build_id);
    if (!build?.contact_token_hash || await hashContactToken(body.access_token) !== build.contact_token_hash || !build.owner_id) return Response.json({ error: 'Unauthorized submission.' }, { status: 401 });
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const message = String(body.message || '').trim();
    if (!name || name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !message || message.length > 4000 || phone.length > 60) return Response.json({ error: 'Enter a name, valid email and message.' }, { status: 400 });
    const query = { build_id: build.id, email, created_date: { $gte: new Date(Date.now() - 3600000).toISOString() } };
    if (await db.WebsiteEnquiry.count(query) >= 5 || await db.WebsiteEnquiry.count({ build_id: build.id, created_date: query.created_date }) >= 100) return Response.json({ error: 'Too many submissions. Please try later.' }, { status: 429 });
    const saved = await db.WebsiteEnquiry.create({ build_id: build.id, owner_id: build.owner_id, site_title: build.title, name, email, phone, message, is_verification: body.is_verification === true });
    return Response.json({ saved: true, submission_id: saved.id }, { status: 201 });
  } catch (error) {
    console.error('Enquiry storage failed:', error.message);
    return Response.json({ error: 'Could not save your enquiry. Please try again.' }, { status: 500 });
  }
}