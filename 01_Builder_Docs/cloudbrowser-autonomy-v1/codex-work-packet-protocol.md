# Codex Work-Packet Protocol

## Purpose
Define the only payload an autonomous coding executor may accept. Codex receives one bounded engineering objective, works only on an approved non-production branch/sandbox, and returns evidence for independent validation.

## Owner
Strategic Minds operator owns scope policy. Planner proposes packets. Workflow validates and dispatches. Codex executes only the packet.

## Required packet schema
```json
{
  "work_packet_id": "WP-<project>-<sequence>",
  "contract_version": "1.0",
  "repo": "XTREME-SYSTEMS/cloudbrowser-control",
  "base_sha": "40-char sha",
  "target_branch": "non-main branch",
  "goal": "single bounded outcome",
  "failure_signature": null,
  "evidence_ids": [],
  "allowed_paths": [],
  "forbidden_paths": [
    ".github/workflows/production*",
    "production secret stores"
  ],
  "acceptance_criteria": [],
  "required_validation": [],
  "risk_class": "BRANCH_SAFE",
  "max_files_changed": 12,
  "max_repair_attempts": 3,
  "schema_change": false,
  "deployment_allowed": false,
  "main_write_allowed": false,
  "secret_change_allowed": false,
  "destructive_action_allowed": false,
  "customer_message_allowed": false,
  "spend_allowed": false
}
```

## Packet validation before dispatch
Reject the packet unless:
1. repo exactly matches the approved repo.
2. `base_sha` equals the workflow's verified candidate baseline.
3. target branch exists or is an approved branch to create and is not `main`/`master`.
4. goal is singular and testable.
5. acceptance criteria are objective.
6. required validation names at least one deterministic test.
7. `risk_class` is `BRANCH_SAFE`.
8. every protected-action flag is false.
9. no secret value appears in the packet.
10. path scope is explicit.

## Executor instructions
Codex MUST:
- inspect before editing;
- preserve existing conventions and AGENTS.md rules;
- change the smallest responsible layer;
- avoid unrelated refactors;
- never weaken existing tests or security checks to make a failure disappear;
- never modify `main`;
- never merge a PR;
- never deploy;
- never reveal or copy secrets;
- never alter production configuration;
- run the packet's required local/static checks when available;
- stop and return `BLOCKED` if completion requires a protected action.

## Executor return schema
```json
{
  "work_packet_id": "...",
  "status": "COMPLETED|NO_CHANGE|BLOCKED|FAILED",
  "starting_sha": "...",
  "candidate_sha": "...",
  "changed_files": [],
  "change_summary": [],
  "commands": [
    {"command_class":"build|lint|typecheck|test|other","result":"pass|fail","receipt_ref":"..."}
  ],
  "acceptance_criteria_results": [],
  "known_risks": [],
  "blockers": [],
  "rollback_ref": "..."
}
```

## Branch policy
Preferred naming:
`autonomy/<project>/<work_packet_id>`
or an existing approved development branch such as `fortress/v1.1` when explicitly selected by source truth.

The workflow must verify the returned SHA belongs to the approved target branch before validation.

## Change budget
Default maximum is 12 files per packet. Exceeding the budget requires the planner to split the problem or request approval. Generated lockfile changes caused solely by approved dependency operations may be counted separately but must be receipted.

## Validation handoff
Codex's own checks are preliminary. Independent validation in `validation-mesh.md` is authoritative. A Codex-reported pass does not increment the clean-pass counter by itself.

## Inputs
One validated work packet plus branch-scoped workspace.

## Outputs
Patch/candidate SHA and execution receipt.

## Gates
Schema changes, secret changes, deployment, main writes, destructive actions, payments/spend, and customer messages are prohibited in autonomous packets.

## Validation receipts
Every packet records starting SHA, candidate SHA, changed files, command results, acceptance-criteria results, and rollback reference.

## Rollback path
Before mutation, record starting SHA. If independent validation fails and repair policy chooses rollback, create a branch-local revert to the starting known-good state without force-pushing or rewriting main history.
