# Dependency Hardening Validation Receipt — 2026-09-26

## Scope
Harden the Cloud Browser PR #29 dependency graph without introducing breaking framework migrations.

## Source
- Repository: XTREME-SYSTEMS/cloudbrowser-control
- PR: #29
- Candidate source before dependency hardening: 81138bdaddc6b685e4589c6b6f14cc33a1c24797
- Dependency audit branch: audit/dependency-hardening-pr29-20260926
- Audit workflow run: 36284557287
- Published hardened commit: a836e5897a3d9b7644a055245a8243467db4161c

## Evidence
Initial npm audit:
- critical: 0
- high: 7
- moderate: 6
- low: 3
- total: 16

Safe lockfile remediation simulation:
- critical: 0
- high: 1
- moderate: 2
- low: 2
- total: 5

Targeted adm-zip 0.6.1 + safe lockfile refresh:
- critical: 0
- high: 0
- moderate: 2
- low: 2
- total: 4
- build: PASS
- lint: PASS
- typecheck: PASS

Remaining findings require breaking dependency changes:
- react-router / react-router-dom: moderate, requires major upgrade
- quill / react-quill-new: low, remediation implies major/downgrade behavior

## Decision
PASS for bounded non-breaking dependency hardening candidate.
Do not represent the remaining moderate/low findings as resolved.
Production release still requires the repository's independent Release Gate at the final immutable PR head plus all other protected release gates.

## Rollback
Revert the dependency hardening commit or restore the prior PR #29 dependency files. Main and production remain unchanged at the time of this receipt.
