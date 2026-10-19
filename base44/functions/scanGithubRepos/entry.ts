import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const GITHUB_API = 'https://api.github.com';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const { query, language, maxResults = 10 } = body || {};
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    const token = secrets.get('GITHUB_API_KEY');
    if (!token) {
      return Response.json({ error: 'GITHUB_API_KEY secret not configured' }, { status: 500 });
    }

    const q = language ? `${query} language:${language}` : query;
    const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(maxResults, 30)}`;

    const ghRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'cloud-browser-swarm',
      },
    });
    if (!ghRes.ok) {
      const txt = await ghRes.text();
      return Response.json({ error: `GitHub API error: ${ghRes.status}`, detail: txt }, { status: 502 });
    }
    const data = await ghRes.json();
    const repos = data.items || [];

    const ideas = [];
    for (const repo of repos) {
      const idea = {
        title: `${repo.full_name}: ${repo.description ? repo.description.slice(0, 80) : 'Explore this repo'}`,
        description: repo.description || `GitHub repository ${repo.full_name} with ${repo.stargazers_count} stars.`,
        category: 'research',
        source: 'github',
        source_ref: repo.html_url,
        impact_score: Math.min(10, Math.max(1, Math.round(repo.stargazers_count / 1000) || 3)),
        effort_score: 5,
        risk_score: 3,
        status: 'proposed',
        tags: [repo.language, 'github'].filter(Boolean),
      };
      try {
        const created = await base44.entities.Idea.create(idea);
        ideas.push(created);
      } catch (e) {
        // continue on individual failures
      }
    }

    return Response.json({ ideas, count: ideas.length });
  } catch (err) {
    console.error('scanGithubRepos error', err);
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}