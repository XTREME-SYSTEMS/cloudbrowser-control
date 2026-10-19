import { tool } from 'npm:ai@7.0.16';
import { z } from 'npm:zod@4.4.3';

// Per-agent connector access — only agents listed here get connector tools.
const AGENT_CONNECTORS: Record<string, string[]> = {
  growth_operator: ['google_search_console', 'googlesheets'],
  code_architect: ['github'],
  social_strategist: ['googlecalendar'],
  sales_engine: ['gmail', 'googlecalendar', 'googlesheets'],
  brand_guardian: ['gmail'],
  replicator: ['github'],
};

async function getConnectorToken(base44, type) {
  try {
    const conn = await base44.asServiceRole.connectors.getConnection(type);
    return conn?.accessToken || null;
  } catch { return null; }
}

async function googleApi(token, url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error?.message || `HTTP ${res.status}`, status: res.status };
  return data;
}

export function createConnectorTools(base44, agentName) {
  const permitted = AGENT_CONNECTORS[agentName] || [];
  if (permitted.length === 0) return {};
  const tools = {};

  if (permitted.includes('google_search_console')) {
    tools.gsc_list_sites = tool({
      description: 'List all verified Google Search Console properties for the connected account.',
      inputSchema: z.object({}),
      execute: async () => {
        const token = await getConnectorToken(base44, 'google_search_console');
        if (!token) return { error: 'Google Search Console not connected' };
        const data = await googleApi(token, 'https://www.googleapis.com/webmasters/v3/sites');
        return data.siteEntry?.map((s) => ({ url: s.siteUrl, permission: s.permissionLevel })) || [];
      },
    });
    tools.gsc_search_analytics = tool({
      description: 'Query Google Search Console search analytics (clicks, impressions, CTR, position) for a site.',
      inputSchema: z.object({
        site_url: z.string().describe('The GSC site URL (e.g. sc-domain:example.com or https://example.com)'),
        start_date: z.string().describe('Start date YYYY-MM-DD'),
        end_date: z.string().describe('End date YYYY-MM-DD'),
        dimensions: z.array(z.string()).default(['query']).describe('Group by: query, page, country, device'),
        row_limit: z.number().int().min(1).max(5000).default(100),
      }),
      execute: async ({ site_url, start_date, end_date, dimensions, row_limit }) => {
        const token = await getConnectorToken(base44, 'google_search_console');
        if (!token) return { error: 'Google Search Console not connected' };
        return googleApi(token, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site_url)}/searchAnalytics/query`, {
          method: 'POST', body: JSON.stringify({ startDate: start_date, endDate: end_date, dimensions, rowLimit: row_limit }),
        });
      },
    });
  }

  if (permitted.includes('googlesheets')) {
    tools.sheets_read_range = tool({
      description: 'Read values from a Google Sheets spreadsheet.',
      inputSchema: z.object({
        spreadsheet_id: z.string().describe('The spreadsheet ID'),
        range: z.string().default('A1:Z1000').describe('A1 notation range to read'),
      }),
      execute: async ({ spreadsheet_id, range }) => {
        const token = await getConnectorToken(base44, 'googlesheets');
        if (!token) return { error: 'Google Sheets not connected' };
        return googleApi(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}`);
      },
    });
  }

  if (permitted.includes('googlecalendar')) {
    tools.calendar_list_events = tool({
      description: 'List upcoming Google Calendar events.',
      inputSchema: z.object({
        max_results: z.number().int().min(1).max(100).default(10),
        time_min: z.string().optional().describe('Start time ISO (default: now)'),
      }),
      execute: async ({ max_results, time_min }) => {
        const token = await getConnectorToken(base44, 'googlecalendar');
        if (!token) return { error: 'Google Calendar not connected' };
        const params = new URLSearchParams({ maxResults: String(max_results), orderBy: 'startTime', singleEvents: 'true', timeMin: time_min || new Date().toISOString() });
        return googleApi(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
      },
    });
  }

  if (permitted.includes('github')) {
    tools.github_list_repos = tool({
      description: 'List GitHub repositories for the connected account.',
      inputSchema: z.object({ per_page: z.number().int().min(1).max(100).default(30) }),
      execute: async ({ per_page }) => {
        const token = await getConnectorToken(base44, 'github');
        if (!token) return { error: 'GitHub not connected' };
        const res = await fetch(`https://api.github.com/user/repos?per_page=${per_page}&sort=updated`, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } });
        const data = await res.json();
        if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
        return data.map((r) => ({ name: r.full_name, url: r.html_url, updated: r.updated_at, private: r.private }));
      },
    });
  }

  if (permitted.includes('gmail')) {
    tools.gmail_send = tool({
      description: 'Send an email via the connected Gmail account.',
      inputSchema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body (plain text)'),
      }),
      execute: async ({ to, subject, body }) => {
        const token = await getConnectorToken(base44, 'gmail');
        if (!token) return { error: 'Gmail not connected' };
        const email = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
        const encoded = btoa(unescape(encodeURIComponent(email)));
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: encoded }) });
        const data = await res.json();
        if (!res.ok) return { error: data.error?.message || `HTTP ${res.status}` };
        return { sent: true, message_id: data.id };
      },
    });
  }

  return tools;
}