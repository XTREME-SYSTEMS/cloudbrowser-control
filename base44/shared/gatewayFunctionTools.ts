import { tool } from 'npm:ai@7.0.16';
import { z } from 'npm:zod@4.4.3';

// Per-agent permitted backend functions — mirrors the in-app agent tool_configs.
// Each agent can only invoke the functions listed here.
export const AGENT_FUNCTIONS: Record<string, { name: string; description: string }[]> = {
  orchestrator: [
    { name: 'runAgentLoop', description: 'Dispatch an autonomous agent task cycle to execute pending AgentTasks' },
    { name: 'runWebsiteBuilder', description: 'Build and deploy a website for a given niche' },
    { name: 'runGrowthMission', description: 'Run a full SEO/growth audit on a domain' },
    { name: 'runDomainDiscovery', description: 'Discover available domains for given keywords' },
    { name: 'runAutonomousBrowserTask', description: 'Run a stealth browser automation task (scrape, form-fill, captcha-solve)' },
    { name: 'runBatchOperation', description: 'Run a batch multi-site operation' },
  ],
  growth_operator: [
    { name: 'runGrowthMission', description: 'Run a full SEO/growth audit on a domain' },
    { name: 'runKeywordIntelligence', description: 'Research keywords and search volume for a domain' },
    { name: 'serpMeasurement', description: 'Measure SERP rankings for target keywords' },
    { name: 'runAutonomousBrowserTask', description: 'Run a stealth browser task to scrape competitor sites' },
  ],
  code_architect: [
    { name: 'runWebsiteBuilder', description: 'Build and deploy a website for a given niche' },
    { name: 'runRepoGenerator', description: 'Create a GitHub repository for a project' },
    { name: 'runTemplateGenerator', description: 'Generate a site template for a niche' },
    { name: 'runAutonomousBrowserTask', description: 'Run a browser task to test a deployed site' },
  ],
  social_strategist: [
    { name: 'runMarketingEngine', description: 'Run social media marketing campaigns' },
    { name: 'generateContentAtScale', description: 'Generate content assets at scale' },
    { name: 'runAutonomousBrowserTask', description: 'Run a browser task to research competitor social profiles' },
  ],
  sales_engine: [
    { name: 'runMarketingEngine', description: 'Run sales/outreach marketing campaigns' },
    { name: 'generateContentAtScale', description: 'Generate outreach content at scale' },
    { name: 'runAutonomousBrowserTask', description: 'Run a browser task to research prospects' },
  ],
  brand_guardian: [
    { name: 'generateContentAtScale', description: 'Generate brand content assets at scale' },
    { name: 'runAutonomousBrowserTask', description: 'Run a browser task to audit brand presence' },
  ],
  replicator: [
    { name: 'runBatchOperation', description: 'Run a batch multi-site clone operation' },
    { name: 'provisionCloneDeployment', description: 'Provision a clone deployment to a new target' },
    { name: 'runWebsiteBuilder', description: 'Build and deploy a website for a new target' },
    { name: 'runRepoGenerator', description: 'Create a GitHub repository for a clone' },
  ],
  swarm: [
    { name: 'runAutonomousSwarm', description: 'Run the autonomous swarm for parallel task execution' },
    { name: 'runBatchOperation', description: 'Run a batch operation across multiple targets' },
    { name: 'runAgentLoop', description: 'Dispatch an autonomous agent task cycle' },
  ],
};

// Creates a single call_function tool scoped to the agent's permitted functions.
// The tool validates the function name against the allowlist before invoking.
export function createFunctionTools(base44, agentName) {
  const permitted = AGENT_FUNCTIONS[agentName];
  if (!permitted || permitted.length === 0) return {};

  const allowedNames = new Set(permitted.map((f) => f.name));
  const functionList = permitted.map((f) => `- ${f.name}: ${f.description}`).join('\n');

  return {
    call_function: tool({
      description: `Invoke a backend function to execute real work. Permitted functions:\n${functionList}\nPass the function_name and a body object with the function's parameters.`,
      inputSchema: z.object({
        function_name: z.string().min(1).max(100).describe('One of the permitted function names listed above'),
        body: z.record(z.any()).default({}).describe('The function input parameters as a JSON object'),
      }),
      execute: async ({ function_name, body }) => {
        if (!allowedNames.has(function_name)) {
          return { error: `Function '${function_name}' is not permitted for agent '${agentName}'.` };
        }
        try {
          const res: any = await base44.functions.invoke(function_name, body || {});
          return res?.data ?? res;
        } catch (err: any) {
          return { error: err.message };
        }
      },
    }),
  };
}