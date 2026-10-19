// Swarm Nexus — Agent Catalog
// 30 role templates organized into 6 groups.

export const AGENT_GROUPS = [
  { id: 'core', label: 'Core', color: '#3b82f6' },
  { id: 'engineering', label: 'Engineering', color: '#10b981' },
  { id: 'research', label: 'Research', color: '#a855f7' },
  { id: 'creative', label: 'Creative', color: '#f59e0b' },
  { id: 'business', label: 'Business', color: '#ef4444' },
  { id: 'specialist', label: 'Specialist', color: '#06b6d4' },
];

export const AGENT_CATALOG = [
  // Core
  { id: 'swarm_lead', name: 'Swarm Lead', group: 'core', description: 'Orchestrates the swarm, decomposes prompts, assigns tasks, synthesizes results.', icon: 'Network', defaultOn: true },
  { id: 'code_analyst', name: 'Code Analyst', group: 'core', description: 'Reviews code, identifies issues, proposes refactors and improvements.', icon: 'FileCode', defaultOn: true },
  { id: 'web_researcher', name: 'Web Researcher', group: 'core', description: 'Gathers information across the web and returns structured research with sources.', icon: 'Globe', defaultOn: true },
  { id: 'swarm_specialist', name: 'General Specialist', group: 'core', description: 'Handles focused sub-tasks that don\'t fit a specific specialist role.', icon: 'Bot', defaultOn: false },

  // Engineering
  { id: 'architect', name: 'Architect', group: 'engineering', description: 'Designs system architecture, data models, and integration patterns.', icon: 'Boxes', defaultOn: false },
  { id: 'backend_engineer', name: 'Backend Engineer', group: 'engineering', description: 'Implements server-side logic, APIs, and data pipelines.', icon: 'Server', defaultOn: false },
  { id: 'frontend_engineer', name: 'Frontend Engineer', group: 'engineering', description: 'Builds UI components, pages, and client-side interactions.', icon: 'Monitor', defaultOn: false },
  { id: 'devops_engineer', name: 'DevOps Engineer', group: 'engineering', description: 'Manages deployment, CI/CD, infrastructure, and observability.', icon: 'GitBranch', defaultOn: false },
  { id: 'security_auditor', name: 'Security Auditor', group: 'engineering', description: 'Reviews code and config for vulnerabilities and compliance issues.', icon: 'ShieldCheck', defaultOn: false },
  { id: 'test_engineer', name: 'Test Engineer', group: 'engineering', description: 'Writes and runs tests, identifies coverage gaps, validates behavior.', icon: 'CheckCircle', defaultOn: false },

  // Research
  { id: 'market_researcher', name: 'Market Researcher', group: 'research', description: 'Analyzes markets, competitors, and industry trends.', icon: 'TrendingUp', defaultOn: false },
  { id: 'data_scientist', name: 'Data Scientist', group: 'research', description: 'Analyzes datasets, builds models, surfaces insights.', icon: 'BarChart', defaultOn: false },
  { id: 'trend_analyst', name: 'Trend Analyst', group: 'research', description: 'Identifies emerging trends and signals across domains.', icon: 'Activity', defaultOn: false },
  { id: 'fact_checker', name: 'Fact Checker', group: 'research', description: 'Verifies claims, cross-references sources, flags inaccuracies.', icon: 'Search', defaultOn: false },
  { id: 'literature_reviewer', name: 'Literature Reviewer', group: 'research', description: 'Surveys academic and technical literature on a topic.', icon: 'BookOpen', defaultOn: false },

  // Creative
  { id: 'copywriter', name: 'Copywriter', group: 'creative', description: 'Writes marketing copy, UX text, and content.', icon: 'PenLine', defaultOn: false },
  { id: 'ux_designer', name: 'UX Designer', group: 'creative', description: 'Designs user flows, wireframes, and interaction patterns.', icon: 'MousePointerClick', defaultOn: false },
  { id: 'brand_strategist', name: 'Brand Strategist', group: 'creative', description: 'Defines brand voice, positioning, and messaging.', icon: 'Sparkles', defaultOn: false },
  { id: 'content_strategist', name: 'Content Strategist', group: 'creative', description: 'Plans content calendars, topics, and distribution.', icon: 'Calendar', defaultOn: false },
  { id: 'visual_designer', name: 'Visual Designer', group: 'creative', description: 'Creates visual concepts, layouts, and design systems.', icon: 'Palette', defaultOn: false },

  // Business
  { id: 'product_manager', name: 'Product Manager', group: 'business', description: 'Defines requirements, priorities, and roadmaps.', icon: 'ClipboardList', defaultOn: false },
  { id: 'growth_hacker', name: 'Growth Hacker', group: 'business', description: 'Identifies and executes growth experiments and tactics.', icon: 'Rocket', defaultOn: false },
  { id: 'sales_analyst', name: 'Sales Analyst', group: 'business', description: 'Analyzes sales pipelines, forecasts, and conversion data.', icon: 'DollarSign', defaultOn: false },
  { id: 'ops_manager', name: 'Operations Manager', group: 'business', description: 'Optimizes processes, workflows, and resource allocation.', icon: 'Settings', defaultOn: false },
  { id: 'finance_analyst', name: 'Finance Analyst', group: 'business', description: 'Models costs, revenue, and financial scenarios.', icon: 'Calculator', defaultOn: false },

  // Specialist
  { id: 'seo_specialist', name: 'SEO Specialist', group: 'specialist', description: 'Optimizes pages for search, analyzes keywords and rankings.', icon: 'Search', defaultOn: false },
  { id: 'legal_reviewer', name: 'Legal Reviewer', group: 'specialist', description: 'Reviews contracts, terms, and compliance documents.', icon: 'Scale', defaultOn: false },
  { id: 'translator', name: 'Translator', group: 'specialist', description: 'Translates content between languages with cultural nuance.', icon: 'Languages', defaultOn: false },
  { id: 'data_engineer', name: 'Data Engineer', group: 'specialist', description: 'Builds data pipelines, ETL, and storage systems.', icon: 'Database', defaultOn: false },
  { id: 'ai_trainer', name: 'AI Trainer', group: 'specialist', description: 'Fine-tunes prompts, evaluates model outputs, curates datasets.', icon: 'Brain', defaultOn: false },
];

export const DEFAULT_AGENTS = AGENT_CATALOG.filter(a => a.defaultOn).map(a => a.id);

export function getAgentById(id) {
  return AGENT_CATALOG.find(a => a.id === id);
}

export function getGroupById(id) {
  return AGENT_GROUPS.find(g => g.id === id);
}