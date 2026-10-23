#!/usr/bin/env bash
#
# Pre-flight gate for the portable clone. Run from the repository root:
#
#   ./portable/scripts/preflight.sh
#
# Exits 0 only when the repository is safe and complete enough to push to a new
# GitHub account and deploy. Blocking checks fail; advisory checks warn.
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 2
ROOT="$(pwd)"

if [ "${1:-}" = "--help" ]; then
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

BLOCKED=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; BLOCKED=1; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

section "Runtime"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -ge 24 ]; then pass "node $(node -v) satisfies the engines' node 24 pin"
else fail "node $(node -v) — the services pin node:24 and the gate runs on 24"; fi

section "Isolation invariant — the portable layers must not touch the platform"
if node --test tests/portable-core.contract.test.mjs >/tmp/preflight-portable.log 2>&1; then
  pass "portable-core contract suite ($(grep -c '^✔' /tmp/preflight-portable.log) assertions)"
else
  fail "portable-core contract suite failed — see /tmp/preflight-portable.log"; tail -20 /tmp/preflight-portable.log
fi

# Test files are excluded on purpose, matching tests/portable-core.contract.test.mjs:
# one engine suite deliberately READS platform source as a fixture (it asserts the
# SkipTrace page still calls the platform data API). That is a migration tripwire,
# not runtime coupling.
COUPLING="$(grep -rnE '@base44/sdk|base44Client|createClientFromRequest|base44\.(entities|functions|auth|integrations)' \
  browser-engine api worker operator shared db \
  --include='*.js' --include='*.mjs' --include='*.json' --include='*.sql' \
  --exclude-dir=tests --exclude-dir=node_modules --exclude='*.test.js' 2>/dev/null)"
if [ -z "$COUPLING" ]; then pass "no platform coupling in the portable layers"
else fail "platform coupling reintroduced:"; printf '%s\n' "$COUPLING" | head -10; fi

section "Engine suite, including the self-heal contract"
if (cd browser-engine && node --test tests/*.test.js) >/tmp/preflight-engine.log 2>&1; then
  pass "browser-engine tests: $(grep -oE '^ℹ pass [0-9]+' /tmp/preflight-engine.log | grep -oE '[0-9]+') passing"
else
  fail "browser-engine tests failed — see /tmp/preflight-engine.log"; tail -25 /tmp/preflight-engine.log
fi

section "Service entry points parse"
for f in browser-engine/server.js api/server.js worker/worker.js operator/index.js; do
  if node --check "$f" >/dev/null 2>&1; then pass "$f"; else fail "$f does not parse"; fi
done

section "Reproducible builds — every deployable service needs a lockfile"
MISSING_LOCK=0
for d in api worker browser-engine operator; do
  if [ -f "$d/package-lock.json" ]; then pass "$d/package-lock.json present"
  else fail "$d/package-lock.json MISSING"; MISSING_LOCK=1; fi
done
if [ "$MISSING_LOCK" -eq 1 ]; then
  printf '\n  Fix it before pushing — the repository release gate fails without these:\n'
  printf '    npm install --package-lock-only --omit=optional --prefix api\n'
  printf '    npm install --package-lock-only --omit=optional --prefix worker\n'
  printf '    npm install --package-lock-only --omit=optional --prefix browser-engine\n'
fi

section "Secret hygiene"
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  fail ".env is TRACKED in git — remove it from the index and rotate anything it held"
else
  pass ".env is not tracked"
fi

# An .env.example is a template and is meant to be committed, at any depth.
# A real .env is not, and one in history travels with the push.
LEAKED="$(git log --all --pretty=format: --name-only --diff-filter=A 2>/dev/null | sort -u | grep -E '(^|/)\.env($|\.)' | grep -vE '\.env\.example$' || true)"
if [ -n "$LEAKED" ]; then
  warn "an env file was committed at some point in history — a push carries it to the new account:"
  printf '%s\n' "$LEAKED" | sed 's/^/         /'
else
  pass "no env file ever committed outside the template"
fi

# External credentials must stay empty in the template. Non-empty local dev
# defaults (ports, timeouts, ENGINE_API_KEY) are expected and are not flagged.
CREDENTIALS='SUPABASE_SERVICE_KEY ENCRYPTION_KEY RAILWAY_API_TOKEN VERCEL_API_TOKEN GITHUB_TOKEN RESEND_API_KEY CAPTCHA_SOLVER_API_KEY TWOCAPTCHA_API_KEY BLOB_READ_WRITE_TOKEN'
DIRTY=""
for name in $CREDENTIALS; do
  if grep -qE "^${name}=.+" .env.example 2>/dev/null; then DIRTY="$DIRTY $name"; fi
done
if [ -n "$DIRTY" ]; then
  fail "the env template carries a value for:$DIRTY — blank it and rotate the credential before pushing"
else
  pass "external credentials are empty in .env.example"
fi

section "Verdict"
if [ "$BLOCKED" -eq 0 ]; then
  printf '  \033[32mReady to push.\033[0m Next: CUTOVER.md step 4.\n\n'
  exit 0
fi
printf '  \033[31mBLOCKED.\033[0m Fix the FAIL lines above, then re-run.\n\n'
exit 1