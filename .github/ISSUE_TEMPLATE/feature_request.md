---
name: Feature Request
about: Propose a focused improvement to TrustMint contracts, SDK, dashboard, or documentation
title: "[feat] "
labels: ["enhancement"]
assignees: []
---

> **Security & Privacy Notice:**
> - For suspected security issues, follow [`SECURITY.md`](../../SECURITY.md) instead of opening a public issue.
> - Do not include secret keys, mnemonics, or real customer/KYC identity records in examples or attachments.

## Problem Statement
Describe the developer, operator, or holder problem this proposal addresses.

## Proposed Solution & Scope
Outline the proposed behavior and which files/components (`contracts/`, `sdk/`, `frontend/`, `docs/`) are affected.

## Compatibility, Storage, and Authorization Impact
- **Public contract ABI / method signatures affected?** (Yes / No)
- **Soroban persistent/instance storage layout (`DataKey`) affected?** (Yes / No)
- **Authorization (`require_auth`) or fail-closed compliance checks affected?** (Yes / No)

## Acceptance & Verification Plan
Describe the unit tests (`cargo test --features testutils`), SDK checks (`npm run build:sdk`), or frontend builds (`npm run build`) that will verify this change.