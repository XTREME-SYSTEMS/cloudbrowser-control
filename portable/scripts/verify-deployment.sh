#!/usr/bin/env bash
#
# Smoke-test a deployed CloudBrowser stack.
#
#   ENGINE_URL=https://... ENGINE_API_KEY=... ./portable/scripts/verify-deployment.sh
#
# Optional:
#   ENGINE_URL_2 / ENGINE_URL_3        additional engines
#   ENGINE_API_KEY_2 / ENGINE_API_KEY_3  only if they differ from ENGINE_API_KEY
#   API_URL                            the gateway, checks /health
#   OPERATOR_URL                       the operator, checks /operator/health
#
# Asserts what actually matters: that each engine can LAUNCH A BROWSER, that the
# hardened self-heal surface is present, and that a pool recycle restores warm
# capacity. A green /health alone is not sufficient — that is the signal that was
# reporting "healthy" while the engine could not start a single browser.
set -uo pipefail

if [ "${1:-}" = "--help" ]; then
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

FAILED=0
ATTEMPTED=""
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILED=1; }
info() { printf '  \033[36m····\033[0m %s\n' "$1"; }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Read a dotted path out of JSON on stdin. Empty string when absent.
json() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);let v=j;for(const k of process.argv[1].split(".")){if(v==null){v=undefined;break}v=v[k]}console.log(v===undefined||v===null?"":String(v))}catch(e){console.log("")}})' "$1"
}

check_engine() {
  local label="$1" url="$2" key="$3"
  [ -z "$url" ] && return 0
  url="${url%/}"
  ATTEMPTED="$ATTEMPTED $label"

  section "Engine $label — $url"

  local health
  health="$(curl -sS -m 20 -H "x-api-key: $key" "$url/health" 2>/dev/null)"
  if [ -z "$health" ]; then fail "$label /health unreachable — check the deployment and ENGINE_API_KEY"; return; fi
  if [ "$(printf '%s' "$health" | json ok)" != "true" ]; then fail "$label /health did not report ok"; return; fi

  local status deficit
  status="$(printf '%s' "$health" | json status)"
  deficit="$(printf '%s' "$health" | json pool_deficit)"
  info "status=$status pool_deficit=${deficit:-n/a} active_sessions=$(printf '%s' "$health" | json active_sessions)/$(printf '%s' "$health" | json max_sessions)"

  if [ -z "$deficit" ]; then
    fail "$label is running a build WITHOUT the self-heal fields (no pool_deficit/self_heal in /health)"
  elif [ "$status" = "healthy" ]; then
    pass "$label reports healthy with no pool deficit"
  else
    fail "$label reports status=$status — it cannot currently serve; last launch error: $(printf '%s' "$health" | json self_heal.last_launch_error)"
  fi

  # The only verdict that matters: can it actually start a browser?
  local readiness
  readiness="$(curl -sS -m 90 -H "x-api-key: $key" "$url/readiness" 2>/dev/null)"
  if [ "$(printf '%s' "$readiness" | json browser_launch)" = "verified" ]; then
    pass "$label launched a real browser"
  else
    fail "$label could NOT launch a browser: $(printf '%s' "$readiness" | json error)"
  fi

  # Self-healing pool: recycling must restore warm capacity.
  local recycled size capacity
  recycled="$(curl -sS -m 150 -X POST -H "x-api-key: $key" "$url/pool/recycle" 2>/dev/null)"
  if [ -z "$recycled" ]; then
    fail "$label has no /pool/recycle — old build without the self-healing pool"
    return
  fi
  size="$(printf '%s' "$recycled" | json pool_size)"
  capacity="$(printf '%s' "$recycled" | json pool_capacity)"
  if [ -n "$size" ] && [ -n "$capacity" ] && [ "$size" = "$capacity" ]; then
    pass "$label recycled to a full pool ($size/$capacity)"
  else
    fail "$label recycled to ${size:-?}/${capacity:-?} — it cannot hold warm capacity"
  fi
}

section "Inputs"
echo "  ENGINE_URL=${ENGINE_URL:-<unset>}"
echo "  ENGINES TO CHECK=${ENGINE_URL:-none}$([ -n "${ENGINE_URL_2:-}" ] && echo ' engine-2')$([ -n "${ENGINE_URL_3:-}" ] && echo ' engine-3')"

if [ -z "${ENGINE_URL:-}" ] || [ -z "${ENGINE_API_KEY:-}" ]; then
  echo
  echo "ENGINE_URL and ENGINE_API_KEY are both required. Example:"
  echo "  ENGINE_URL=https://cloudbrowser-engine-production.up.railway.app \\"
  echo "  ENGINE_API_KEY=\$ENGINE_API_KEY ./portable/scripts/verify-deployment.sh"
  exit 2
fi

check_engine "engine-1" "${ENGINE_URL}" "${ENGINE_API_KEY}"
check_engine "engine-2" "${ENGINE_URL_2:-}" "${ENGINE_API_KEY_2:-$ENGINE_API_KEY}"
check_engine "engine-3" "${ENGINE_URL_3:-}" "${ENGINE_API_KEY_3:-$ENGINE_API_KEY}"

if [ -n "${API_URL:-}" ]; then
  section "API gateway — ${API_URL}"
  api_health="$(curl -sS -m 20 "${API_URL%/}/health" 2>/dev/null)"
  if [ "$(printf '%s' "$api_health" | json ok)" = "true" ]; then
    pass "api /health ok"
  elif [ -n "$api_health" ]; then
    pass "api responded on /health ($(printf '%s' "$api_health" | head -c 120))"
  else
    fail "api /health unreachable at ${API_URL%/}/health"
  fi
fi

if [ -n "${OPERATOR_URL:-}" ]; then
  section "Operator — ${OPERATOR_URL}"
  op_health="$(curl -sS -m 20 "${OPERATOR_URL%/}/operator/health" 2>/dev/null)"
  if [ -n "$op_health" ]; then pass "operator /operator/health responded"
  else fail "operator /operator/health unreachable"; fi
fi

section "Not covered by HTTP probes"
echo "  worker        — no HTTP surface; confirm a successful deploy from its logs"
echo "  Postgres      — confirm db/migrations/001_portable_core.sql was applied"

section "Verdict"
if [ "$FAILED" -eq 0 ]; then
  printf '  \033[32mAll checks passed\033[0m for:%s\n' "$ATTEMPTED"
  echo "  Safe to proceed to CUTOVER.md step 7."
  echo
  exit 0
fi
printf '  \033[31mFAILURES above.\033[0m Do NOT cut over on a partial pass.\n\n'
exit 1