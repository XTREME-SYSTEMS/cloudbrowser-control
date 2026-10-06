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

## Integration Architecture — Vercel AI Gateway (No Base44 Integration Credits)

ALL Base44 Core integrations have been replaced with self-hosted gateway modules. The system no longer depends on Base44 integration credits for any functionality.

### Gateway Modules (base44/shared/)

- **`vercelAiGateway.ts`** — Replaces `Core.InvokeLLM`, `Core.GenerateImage`, `Core.GenerateSpeech`, `Core.TranscribeAudio`, `Core.ExtractDataFromUploadedFile`. Routes to `https://ai-gateway.vercel.sh/v1` (OpenAI-compatible). Uses `VERCEL_AI_GATEWAY_API_KEY`.
- **`storageGateway.ts`** — Replaces `Core.UploadFile`, `Core.UploadPublicFile`, `Core.UploadPrivateFile`, `Core.CreateFileSignedUrl`. Routes to Vercel Blob (`https://blob.vercel-storage.com`). Uses `BLOB_READ_WRITE_TOKEN`.
- **`emailGateway.ts`** — Replaces `Core.SendEmail`. Routes to Resend API (`https://api.resend.com/emails`). Uses `RESEND_API_KEY` and optionally `RESEND_FROM_EMAIL`.

### Backend Function Wrappers (base44/functions/)

- **`invokeGatewayLLM`** — Frontend-accessible wrapper for `vercelAiGateway.invokeLLM`. Call via `base44.functions.invoke('invokeGatewayLLM', { prompt, response_json_schema, add_context_from_internet })`.
- **`uploadFileGateway`** — Frontend-accessible wrapper for `storageGateway.uploadFile/uploadPublicFile/uploadPrivateFile`. Call via `base44.functions.invoke('uploadFileGateway', { action, file_data, filename, content_type })`.

### Frontend Helper (src/lib/)

- **`fileUpload.js`** — Drop-in replacement for `base44.integrations.Core.UploadFile/UploadPublicFile` in frontend code. Converts File to base64, calls `uploadFileGateway`, returns `{ file_url }`.

### Required Secrets

- `VERCEL_AI_GATEWAY_API_KEY` — ✅ Set. Powers all LLM, image, speech, transcription, and extraction calls.
- `BLOB_READ_WRITE_TOKEN` — ⏳ Not set. Required for file uploads (screenshots, backups, exports, clone assets). Add in dashboard → Secrets.
- `RESEND_API_KEY` — ⏳ Not set. Required for email sending (notifications, keyword intelligence alerts). Add in dashboard → Secrets.
- `RESEND_FROM_EMAIL` — Optional. Verified sender address for Resend. Defaults to `onboarding@resend.dev`.

### What's Disabled

- **Video generation** (`Core.GenerateVideo`) — No Vercel AI Gateway equivalent. The call in `runAgentLoop` is a no-op (`videoUrl = null`) until a dedicated video API is configured.
- **Push notifications** (`Core.SendPushNotification`) — Not used in the active codebase. Would need FCM/APNS setup if required.

### Migration Pattern

When adding new code that needs AI, file storage, or email:
1. **Backend functions**: Import from `base44/shared/vercelAiGateway.ts`, `storageGateway.ts`, or `emailGateway.ts`.
2. **Frontend pages**: For LLM, call `base44.functions.invoke('invokeGatewayLLM', ...)`. For file uploads, import from `@/lib/fileUpload`.
3. **Never use** `base44.integrations.Core.*` — these are blocked by credit exhaustion and will remain so.