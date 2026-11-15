## Summary
Closes #

Briefly describe what this pull request changes and why.

## Affected Components
- [ ] `contracts/` (Soroban smart contracts)
- [ ] `sdk/` (`@trustmint/sdk` TypeScript client)
- [ ] `frontend/` (React + Vite dashboard)
- [ ] `tests/integration/` or `scripts/`
- [ ] `docs/` or repository configuration

## Compatibility, Storage & Security Impact
- **Contract ABI or storage layout changes:** (None / Describe changes to `DataKey` or public signatures)
- **Authorization & fail-closed behavior:** Confirm that `require_auth()` and compliance/KYC checks remain enforced.

## Verification & Checks Run
- [ ] `cargo fmt --all -- --check`
- [ ] `cargo clippy --all --all-targets -- -D warnings`
- [ ] `cargo test --features testutils`
- [ ] `npm run build:sdk` (if `sdk/` changed)
- [ ] `cd frontend && npm run lint && npm run build` (if `frontend/` changed)

## Safety Checklist
- [ ] No private keys (`S...`), seed phrases, `.env` files, or real identity/KYC documents are included in code, tests, commits, or screenshots.
- [ ] Any security vulnerabilities discovered were reported privately via [`SECURITY.md`](SECURITY.md).