#!/usr/bin/env bash
#
# Mirror this repository into a NEW GitHub account.
#
#   NEW_GITHUB_REPO=git@github.com:<new-account>/cloudbrowser-control.git \
#     ./portable/scripts/push-to-new-account.sh --dry-run    # review first
#   NEW_GITHUB_REPO=git@github.com:<new-account>/cloudbrowser-control.git \
#     ./portable/scripts/push-to-new-account.sh              # then push
#
# Pushes `main` and tags to a remote named `clone`. It does NOT create the
# repository (that needs the new account's credentials), does NOT rewrite
# history, and does NOT touch `origin`.
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 2

if [ "${1:-}" = "--help" ]; then
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

REMOTE="clone"
BRANCH="${BRANCH:-main}"

if [ -z "${NEW_GITHUB_REPO:-}" ]; then
  echo "NEW_GITHUB_REPO is not set."
  echo
  echo "  NEW_GITHUB_REPO=git@github.com:<new-account>/cloudbrowser-control.git $0 ${1:-}"
  echo
  echo "Create an EMPTY repository in the new account first (no README, no licence)."
  exit 2
fi

echo "Repository : $(pwd)"
echo "Remote     : $REMOTE -> $NEW_GITHUB_REPO"
echo "Branch     : $BRANCH"
echo "Mode       : $([ "$DRY" -eq 1 ] && echo 'dry run (nothing will be pushed)' || echo 'PUSH')"
echo

# --- the push carries the whole history, so say so plainly -------------------
echo "History warning: a push transfers every commit. Anything ever committed —"
echo "including a credential since rotated — arrives with it."
TRACKED_ENV="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '^\.env\.example$' || true)"
if [ -n "$TRACKED_ENV" ]; then
  echo
  echo "  !! these env files are TRACKED and will be pushed:"
  printf '     %s\n' $TRACKED_ENV
  echo "  Remove them from the index and rotate what they held:"
  echo "     git rm --cached <file> && git commit -m 'chore: stop tracking env file'"
fi
HISTORY_ENV="$(git log --all --pretty=format: --name-only --diff-filter=A 2>/dev/null | sort -u | grep -E '(^|/)\.env($|\.)' | grep -vE '\.env\.example$' || true)"
if [ -n "$HISTORY_ENV" ]; then
  echo
  echo "  !! an env file exists somewhere in history:"
  printf '     %s\n' $HISTORY_ENV
  echo "  Treat every value it could have held as compromised before going live."
fi

echo
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit or stash first — this pushes commits, not files."
  git status --short | head -20
  exit 1
fi
echo "Working tree clean."

if git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "Remote '$REMOTE' already exists: $(git remote get-url "$REMOTE")"
  if [ "$(git remote get-url "$REMOTE")" != "$NEW_GITHUB_REPO" ]; then
    echo "It points somewhere else. Set it explicitly if that is wrong:"
    echo "  git remote set-url $REMOTE $NEW_GITHUB_REPO"
    exit 1
  fi
else
  if [ "$DRY" -eq 1 ]; then
    echo "Would add: git remote add $REMOTE $NEW_GITHUB_REPO"
  else
    git remote add "$REMOTE" "$NEW_GITHUB_REPO" || exit 1
    echo "Added remote '$REMOTE'."
  fi
fi

echo
if [ "$DRY" -eq 1 ]; then
  echo "Dry run — would execute:"
  echo "  git push $REMOTE $BRANCH --tags"
  echo
  echo "Re-run without --dry-run to push."
  exit 0
fi

git push "$REMOTE" "$BRANCH" --tags || exit 1

echo
echo "Pushed. Next: CUTOVER.md step 6 — create the Railway project from this repository."
echo "Verify the new remote has what you expect:"
echo "  git ls-remote --heads $REMOTE"