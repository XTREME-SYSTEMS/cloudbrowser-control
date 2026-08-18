# Browser Engine — Self-Hosted Browserbase Replacement

A Node.js + Playwright service that runs headless Chromium and exposes an authenticated HTTP API. Deploy this to your Google Cloud account, then point the Base44 control-plane app at it.

## Quick Start (Local)

```bash
cd browser-engine
npm install
npx playwright install chromium
ENGINE_API_KEY=your-secret-key npm start
```

## Deploy to Google Cloud Run

1. **Install prerequisites**: Google Cloud CLI, Docker, and authenticate:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable required APIs**:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com
   ```

3. **Submit the build** (from the `browser-engine/` directory):
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/browser-engine
   ```

4. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy browser-engine \
     --image gcr.io/YOUR_PROJECT_ID/browser-engine \
     --platform managed \
     --region us-central1 \
     --port 8080 \
     --memory 2Gi \
     --cpu 2 \
     --min-instances 1 \
     --max-instances 10 \
     --timeout 300 \
     --set-env-vars ENGINE_API_KEY=your-secret-key,MAX_SESSIONS=10 \
     --allow-unauthenticated
   ```

   > **Security**: For production, remove `--allow-unauthenticated` and use Cloud IAM or a VPC connector. The API key in the `x-api-key` header is the primary auth layer.

5. **Copy the service URL** from the output (e.g. `https://browser-engine-xxxx.run.app`).

6. **Set secrets in your Base44 app** (Settings → Secrets):
   - `BROWSER_ENGINE_URL` = the Cloud Run URL from step 5
   - `BROWSER_ENGINE_API_KEY` = the `ENGINE_API_KEY` value you set in step 4

## Deploy to a GCE VM (Alternative)

```bash
# On the VM:
sudo apt update && sudo apt install -y nodejs npm
git clone <your-repo> && cd browser-engine
npm install && npx playwright install chromium
ENGINE_API_KEY=your-secret-key PORT=8080 node server.js
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ENGINE_API_KEY` | `changeme` | Shared secret for API auth |
| `PORT` | `8080` | HTTP listen port |
| `MAX_SESSIONS` | `10` | Max concurrent browser sessions |
| `DEFAULT_TIMEOUT` | `30000` | Default action timeout (ms) |
| `SESSION_TTL_MS` | `300000` | Idle session timeout (ms) |

## API Endpoints

All endpoints require `x-api-key` header.

### `GET /health`
Returns engine status and active session count.

### `POST /sessions`
Create a new browser session.
```json
{
  "viewport": { "width": 1280, "height": 720 },
  "userAgent": "...",
  "locale": "en-US",
  "timezone": "America/New_York",
  "geolocation": { "latitude": 40.7, "longitude": -74.0 },
  "proxy": { "server": "host:port", "username": "...", "password": "..." },
  "headers": { "X-Custom": "value" },
  "blockedResources": ["image", "font", "stylesheet"]
}
```

### `POST /sessions/:id/execute`
Execute an action. Body: `{ action_type, selector, value, options }`.

### `GET /sessions/:id`
Get session status, console logs, and network logs.

### `DELETE /sessions/:id`
Close and clean up a session.

### `GET /sessions`
List all active sessions.