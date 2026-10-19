import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const expectedSecret = secrets.get('WORKER_SECRET');
    const isWorker = !!(body?.worker_secret && expectedSecret && body.worker_secret === expectedSecret);
    if (!isWorker) { const user = await base44.auth.me(); if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

    const domain = (body.domain || '').trim().toLowerCase();
    if (!domain) return Response.json({ error: 'domain required' }, { status: 400 });

    const apiKey = secrets.get('GODADDY_API_KEY');
    const apiSecret = secrets.get('GODADDY_API_SECRET');
    if (!apiKey || !apiSecret) return Response.json({ needs_setup: true, message: 'GoDaddy API keys not set. Add GODADDY_API_KEY and GODADDY_API_SECRET as secrets.' });

    const authHeader = `sso-key ${apiKey}:${apiSecret}`;
    const ENDPOINTS = ['https://api.godaddy.com/v1', 'https://api.ote-godaddy.com/v1'];
    let baseUrl = ENDPOINTS[0];
    let checkRes;

    for (const ep of ENDPOINTS) {
      checkRes = await fetch(`${ep}/domains/available?domain=${encodeURIComponent(domain)}&checkType=FAST`, { headers: { Authorization: authHeader, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (checkRes.ok || checkRes.status === 404) { baseUrl = ep; break; }
      if (checkRes.status !== 401) break;
    }

    if (!checkRes.ok) { const errText = await checkRes.text().catch(() => ''); return Response.json({ error: `GoDaddy check error: ${checkRes.status} ${errText.slice(0, 200)}` }, { status: 502 }); }

    const availability = await checkRes.json();
    if (!availability.available) {
      await base44.asServiceRole.entities.DomainInventory.updateMany({ domain }, { $set: { status: 'unavailable' } }).catch(() => {});
      return Response.json({ domain, available: false, price: null });
    }

    const price = availability.currency ? `${(availability.price / 10000000).toFixed(2)} ${availability.currency}` : null;
    await base44.asServiceRole.entities.DomainInventory.updateMany({ domain }, { $set: { status: 'available', price } }).catch(() => {});

    if (!body.buy) return Response.json({ domain, available: true, price });

    const profiles = await base44.asServiceRole.entities.RegistrarProfile.filter({}, { limit: 1 });
    const contact = profiles.items?.[0];
    if (!contact) return Response.json({ needs_contact: true, domain, available: true, price, message: 'No registrar profile found. Create a RegistrarProfile with your contact info first.' });

    const contactInfo = { nameFirst: contact.name_first, nameLast: contact.name_last, email: contact.email, phone: contact.phone || '', address1: contact.address1 || '', city: contact.city || '', state: contact.state || '', postalCode: contact.postal_code || '', country: contact.country || 'US' };
    const buyRes = await fetch(`${baseUrl}/domains`, { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ domain, renewAuto: false, period: 1, contactRegistrant: contactInfo, contactAdmin: contactInfo, contactTech: contactInfo, contactBilling: contactInfo, privacy: true }), signal: AbortSignal.timeout(30000) });

    if (!buyRes.ok) { const errText = await buyRes.text().catch(() => ''); return Response.json({ error: `GoDaddy purchase error: ${buyRes.status} ${errText.slice(0, 300)}` }, { status: 502 }); }

    const purchase = await buyRes.json();
    await base44.asServiceRole.entities.DomainInventory.updateMany({ domain }, { $set: { status: 'bought', price, registered_at: new Date().toISOString(), godaddy_order_id: purchase.orderId || '' } }).catch(() => {});

    return Response.json({ domain, available: true, price, bought: true, order_id: purchase.orderId, message: `Domain ${domain} purchased successfully!` });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}