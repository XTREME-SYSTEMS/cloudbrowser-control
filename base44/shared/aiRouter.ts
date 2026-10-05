import { gatewayCompletion } from './vercelGateway.ts';

export type TaskType =
  | 'planning' | 'code_generation' | 'content_writing' | 'sales_outreach'
  | 'social_content' | 'template_generation' | 'seo_audit' | 'web_search'
  | 'quick_json' | 'complex_reasoning' | 'summarization';

interface ModelConfig { model: string; maxTokens?: number; temperature?: number; label: string; reason: string; }

const ROUTING_TABLE: Record<TaskType, ModelConfig> = {
  planning: { model: 'anthropic/claude-sonnet-4', maxTokens: 4096, temperature: 0.7, label: 'Claude Sonnet 4', reason: 'Best at multi-step decomposition and structured mission briefs' },
  code_generation: { model: 'openai/gpt-4o', maxTokens: 8192, temperature: 0.2, label: 'GPT-4o', reason: 'Strongest code generation and refactoring accuracy' },
  content_writing: { model: 'anthropic/claude-sonnet-4', maxTokens: 4096, temperature: 0.8, label: 'Claude Sonnet 4', reason: 'Superior prose quality, brand voice consistency, persuasive copy' },
  sales_outreach: { model: 'openai/gpt-4o-mini', maxTokens: 2048, temperature: 0.7, label: 'GPT-4o mini', reason: 'Fast, cost-effective for high-volume personalized sequences' },
  social_content: { model: 'openai/gpt-4o-mini', maxTokens: 2048, temperature: 0.85, label: 'GPT-4o mini', reason: 'Creative, platform-native output at low cost for high cadence' },
  template_generation: { model: 'openai/gpt-4o-mini', maxTokens: 2048, temperature: 0.5, label: 'GPT-4o mini', reason: 'Reliable structured JSON output, fast and cheap for batch generation' },
  seo_audit: { model: 'openai/gpt-4o-mini', maxTokens: 2048, temperature: 0.3, label: 'GPT-4o mini', reason: 'Analytical precision at low cost for repeated audit cycles' },
  web_search: { model: 'perplexity/sonar', maxTokens: 2048, temperature: 0.3, label: 'Live Web Research', reason: 'Web-grounded summarization, cost-effective for research volume' },
  quick_json: { model: 'openai/gpt-4o-mini', maxTokens: 1024, temperature: 0.2, label: 'GPT-4o mini', reason: 'Cheapest option for simple structured output' },
  complex_reasoning: { model: 'anthropic/claude-sonnet-4', maxTokens: 8192, temperature: 0.5, label: 'Claude Sonnet 4', reason: 'Deepest reasoning for hard multi-step problems' },
  summarization: { model: 'openai/gpt-4o-mini', maxTokens: 1024, temperature: 0.3, label: 'GPT-4o mini', reason: 'Fast condensation at minimal cost' },
};

export function getModelForTask(taskType: TaskType): ModelConfig { return ROUTING_TABLE[taskType] || ROUTING_TABLE.quick_json; }
export function listRoutes() { return Object.entries(ROUTING_TABLE).map(([type, cfg]) => ({ taskType: type, model: cfg.model, label: cfg.label, reason: cfg.reason, maxTokens: cfg.maxTokens, temperature: cfg.temperature })); }

export async function callVercelGateway(opts: { apiKey: string; taskType: TaskType; systemPrompt: string; userPrompt: string; jsonMode?: boolean; timeoutMs?: number; }): Promise<{ content: string; model: string; provider: string }> {
  const cfg = getModelForTask(opts.taskType);
  const body: any = { model: cfg.model, messages: [{ role: 'system', content: opts.systemPrompt }, { role: 'user', content: opts.userPrompt }], max_tokens: cfg.maxTokens, temperature: cfg.temperature };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };
  return await gatewayCompletion(body, { apiKey: opts.apiKey, timeoutMs: opts.timeoutMs || 30000 });
}

export async function callAI(base44, opts: { vercelKey?: string | null; taskType: TaskType; systemPrompt: string; userPrompt: string; jsonSchema?: object | null; useWebSearch?: boolean; timeoutMs?: number; }): Promise<{ result: any; provider: string; model: string; routedTask: string }> {
  const { content, model, provider } = await callVercelGateway({ apiKey: opts.vercelKey, taskType: opts.taskType, systemPrompt: opts.systemPrompt, userPrompt: opts.userPrompt + (opts.jsonSchema ? `\n\nReturn ONLY valid JSON matching this schema:\n${JSON.stringify(opts.jsonSchema)}` : ''), jsonMode: !!opts.jsonSchema, timeoutMs: opts.timeoutMs });
  const result = opts.jsonSchema ? JSON.parse(content) : content;
  return { result, provider, model, routedTask: opts.taskType };
}