# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.

## Sandbox preview findings

- `docker compose -f docker-compose.base44.yml up -d --build` runs the cloned frontend with Vite on port 3000. Source is bind-mounted; dependencies live in a named volume. The production build is only a verification check, never the preview server.
- This setup uses the existing hosted Base44 API (`https://app.base44.com`) through the Vite plugin's same-origin `/api` proxy. This is an API origin, not a published app URL. The app ID is the one already present in `src/lib/app-params.js`. No external credential is needed just to display the sign-in page; protected data requires the user's normal app login. Writes after login affect hosted data, not an isolated local database.
- `base44 dev` was tested with CLI 0.1.20: it requires CLI authorization before starting a local backend. No authorization or credentials were fabricated. If switching to a local backend, obtain authorization, link the project, and provide Deno for functions; local entity data is ephemeral. Do not silently bypass authentication.
- `operator/` is a separate Railway deployment/scale automation service, not a prerequisite for the frontend. Do not start it for preview: it targets external infrastructure and can mutate it. `browser-engine/` is a separately deployed browser service; the hosted functions resolve its configuration from their own secrets (`ENGINE_URL`, `ENGINE_API_KEY`). Neither service is represented as running locally by this Compose file.
- Local `/run/base44/app.env` values do not configure the hosted function runtime. Hosted integration secrets must be configured in that backend. Do not claim external integrations work based on frontend startup alone.
- Verify with `docker compose -f docker-compose.base44.yml ps`, `curl -f http://localhost:3000/`, and `curl -f http://localhost:3000/api/apps/public/prod/public-settings/by-id/6a837c8e995cc4824aabf594`. `/src/main.jsx` must return transformed source, and `/@vite/client` must remain available. Run `docker compose -f docker-compose.base44.yml exec -T web npm run build` for compilation validation.
- The browser-preview verification tool may report no open browser tab even while HTTP checks pass; this does not indicate a server failure. Request the user open the preview rather than restarting a healthy service.
