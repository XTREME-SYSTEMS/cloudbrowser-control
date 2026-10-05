import { tool } from 'npm:ai@7.0.16';
import { z } from 'npm:zod@4.4.3';

const text = z.string().max(12000);
const number = z.number().finite();
const fields = {
  AgentTask: {
    agent_name: text, domain: text.optional(), task_type: text.optional(), title: text,
    description: text.optional(), status: z.enum(['pending', 'in_progress', 'needs_approval', 'completed', 'failed']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(), result: text.optional(), autonomous: z.boolean().optional(),
  },
  Domain: {
    domain: text, canonical_url: text.optional(), status: z.enum(['onboarding', 'verifying', 'verified', 'active', 'issues', 'paused']).optional(),
    gsc_property: text.optional(), ga4_property: text.optional(), gtm_container: text.optional(), sitemap_url: text.optional(),
    robots_status: text.optional(), competitors: text.optional(), target_keywords: text.optional(), target_geo: text.optional(),
    health_score: number.optional(), index_coverage: text.optional(), last_audit: text.optional(), next_action: text.optional(), notes: text.optional(),
  },
  SystemBuild: {
    title: text, build_type: z.enum(['website', 'web_app', 'landing_page', 'api', 'automation', 'dashboard', 'tool', 'system']), what_to_build: text,
    how_it_looks: text.optional(), how_it_functions: text.optional(), what_it_connects_to: text.optional(), what_it_says: text.optional(),
    how_it_operates: text.optional(), deliver_to: text.optional(), status: z.enum(['spec_submitted', 'planning', 'building', 'deploying', 'delivered', 'failed']).optional(),
    result: text.optional(), task_id: text.optional(),
  },
  DomainInventory: {
    domain: text, tld: text.optional(), keyword: text.optional(), status: z.enum(['discovered', 'available', 'unavailable', 'buying', 'bought', 'failed']).optional(),
    price: text.optional(), registered_at: text.optional(), godaddy_order_id: text.optional(), pipeline_id: text.optional(), repo_url: text.optional(), deploy_url: text.optional(),
  },
  BatchOperation: {
    name: text, batch_size: number.optional(), template_spec: text.optional(), variables: text.optional(), deploy_targets: text.optional(),
    google_connect: z.boolean().optional(), social_connect: z.boolean().optional(), video_generate: z.boolean().optional(), content_optimize: z.boolean().optional(),
    status: z.enum(['queued', 'dispatching', 'running', 'complete', 'failed']).optional(), progress: number.optional(), sites_built: number.optional(),
    sites_deployed: number.optional(), videos_generated: number.optional(), social_posts: number.optional(), task_count: number.optional(),
  },
  FactoryPipeline: {
    name: text, keywords: text.optional(), tlds: text.optional(), max_domains: number.optional(),
    status: z.enum(['discovering', 'buying', 'templating', 'generating', 'building', 'deploying', 'connecting', 'complete', 'failed']).optional(),
    domains_discovered: number.optional(), domains_bought: number.optional(), templates_generated: number.optional(), repos_created: number.optional(),
    sites_deployed: number.optional(), config: text.optional(), task_count: number.optional(),
  },
  WorkerFleet: {
    name: text, poll_interval: number.optional(), max_cycles: number.optional(), report_email: text.optional(),
    focus_area: z.enum(['all', 'growth', 'builds', 'social', 'sales', 'brand']).optional(), deploy_target: z.enum(['local', 'railway', 'both']).optional(),
    active: z.boolean().optional(), last_seen: text.optional(), total_runs: number.optional(), total_actions: number.optional(),
  },
};

function queryFromJSON(value) {
  const parsed = JSON.parse(value || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Filter must be a JSON object.');
  if (/"(?:\$where|__proto__|constructor|prototype)"\s*:/.test(value)) throw new Error('Unsupported filter.');
  return parsed;
}

export function createEntityTools(base44, permittedEntities) {
  const tools = {};
  for (const name of permittedEntities) {
    const entity = base44.entities[name];
    const schema = z.object(fields[name]).strict();
    tools[`read_${name}`] = tool({
      description: `Read a page of ${name} records. query_json is a Mongo-style JSON filter; search, status and ownership filtering happen on the server. Follow next_cursor for another page.`,
      inputSchema: z.object({ query_json: z.string().max(2000).default('{}'), limit: z.number().int().min(1).max(50).default(20), cursor: z.string().optional() }),
      execute: async ({ query_json, limit, cursor }) => await entity.filter(queryFromJSON(query_json), { sort: '-created_date', limit, ...(cursor ? { cursor } : {}) }),
    });
    tools[`count_${name}`] = tool({
      description: `Get the server-side number of ${name} records matching query_json. Use this for totals, not a loaded page's length.`,
      inputSchema: z.object({ query_json: z.string().max(2000).default('{}') }),
      execute: async ({ query_json }) => ({ count: await entity.count(queryFromJSON(query_json)) }),
    });
    tools[`get_${name}`] = tool({
      description: `Read one ${name} record by its ID, subject to the signed-in user's permissions.`,
      inputSchema: z.object({ id: z.string().min(1).max(100) }),
      execute: async ({ id }) => await entity.get(id),
    });
    tools[`create_${name}`] = tool({
      description: `Create and persist one ${name} record using its actual fields. A queued task/spec is not an executed result.`,
      inputSchema: z.object({ data: schema }),
      execute: async ({ data }) => await entity.create(data),
    });
    tools[`update_${name}`] = tool({
      description: `Update the specified ${name} record. Provide only fields being changed; never invent an execution receipt.`,
      inputSchema: z.object({ id: z.string().min(1).max(100), data: schema.partial() }),
      execute: async ({ id, data }) => await entity.update(id, data),
    });
    tools[`delete_${name}`] = tool({
      description: `Delete one ${name} record ONLY when the user explicitly requested that deletion. Never delete as cleanup or to fix a failed tool.`,
      inputSchema: z.object({ id: z.string().min(1).max(100) }),
      execute: async ({ id }) => { await entity.delete(id); return { deleted: true, id }; },
    });
  }
  return tools;
}