# TrustMint Soroban Contract Suite — Source-Checked Threat Model

This threat model documents the trust boundaries, privileged roles, cross-contract call assumptions, protected state invariants, and operational/upgrade limitations of the six Soroban smart contracts in TrustMint.

> **Audit Status:** TrustMint has **not** undergone an independent security audit. Treat all contracts in `contracts/` as experimental reference code; do not deploy them to custody real-world assets or funds without an independent security audit and legal/operational review.

---

## 1. System Scope & Source Map

| Contract Crate | Source Files | Primary Responsibility |
|---|---|---|
| `kyc-registry` | [`contracts/kyc-registry/src/lib.rs`](../contracts/kyc-registry/src/lib.rs), [`test.rs`](../contracts/kyc-registry/src/test.rs) | Stores per-address `KycRecord` (`status`, `verifier`, `tier`, `expiry`, `jurisdiction`) and manages authorized verifiers. |
| `compliance-engine` | [`contracts/compliance-engine/src/lib.rs`](../contracts/compliance-engine/src/lib.rs), [`test.rs`](../contracts/compliance-engine/src/test.rs) | Enforces transfer policies (`ComplianceRules`, address/jurisdiction blocklists, max transfer, min holding period, holder cap) and cross-calls `kyc-registry`. |
| `invoice-token` | [`contracts/invoice-token/src/lib.rs`](../contracts/invoice-token/src/lib.rs), [`test.rs`](../contracts/invoice-token/src/test.rs) | Tokenized invoice lifecycle (issuance, transfer with fee, settlement, redemption) gated by KYC and compliance checks. |
| `property-token` | [`contracts/property-token/src/lib.rs`](../contracts/property-token/src/lib.rs), [`test.rs`](../contracts/property-token/src/test.rs) | Fractional property shares with tier-gated transfers and cumulative dividend-per-share distribution/claims. |
| `carbon-credit-token` | [`contracts/carbon-credit-token/src/lib.rs`](../contracts/carbon-credit-token/src/lib.rs), [`test.rs`](../contracts/carbon-credit-token/src/test.rs) | Carbon credit issuance, transfer, and irreversible retirement with on-chain `RetirementReceipt` records. |
| `rwa-token` | [`contracts/rwa-token/src/lib.rs`](../contracts/rwa-token/src/lib.rs), [`sep41_compliance.rs`](../contracts/rwa-token/src/sep41_compliance.rs), [`test.rs`](../contracts/rwa-token/src/test.rs) | Reference SEP-41-compatible token with integrated KYC/compliance hooks, allowances, freeze/pause, and clawback. |

---

## 2. Actors, Roles, and Trust Assumptions

| Role | Enforcement Mechanism | Capabilities & Trust Assumptions |
|---|---|---|
| **Contract Admin** (`DataKey::Admin`) | `admin.require_auth()` + two-step `propose_admin` / `accept_admin` (`DataKey::PendingAdmin`) | Can configure `ComplianceRules`, manage verifiers (`add_verifier`, `remove_verifier`), update blocklists, mint/issue tokens, freeze accounts, or pause contracts. **Trusted role:** a compromised admin key can halt transfers or alter policy parameters. |
| **KYC Verifier** (`DataKey::VerifierList` in `kyc-registry`) | `verifier.require_auth()` + membership check in `VerifierList` (`KycError::NotVerifier`) | Can call `approve_kyc`, `batch_approve_kyc`, `reject_kyc`, and `revoke_kyc`. **Trusted for eligibility attestations:** an unethical or compromised verifier can approve ineligible addresses or revoke valid holders. |
| **Token Holder** | `from.require_auth()` / `holder.require_auth()` | Can transfer owned balances, approve allowances, redeem settled invoices, claim property dividends, or retire carbon credits, subject to active KYC and compliance rules. |
| **Approved Spender** | `spender.require_auth()` + allowance check (`AllowanceKey`) | Can execute `transfer_from` or `burn_from` up to the unexpired allowance granted by `from`, still subject to full sender/recipient KYC and `compliance-engine` checks. |
| **Soroban RPC / Indexer** | Untrusted transport layer | Used by `sdk/` and `frontend/` for transaction simulation (`simulateTransaction`) and submission. Cannot forge on-chain signatures (`require_auth`), but a malicious or stale RPC can return fabricated simulation results (`--send=no`) or drop transactions. |

---

## 3. Cross-Contract Boundaries & Call Flow

1. **Asset Contract -> `kyc-registry` & `compliance-engine`:**
   - Asset contracts store the `kyc_registry` and `compliance_engine` contract addresses at initialization (`initialize(...)`).
   - During `transfer`, `transfer_from`, and issuance/minting, asset contracts invoke `check_transfer` / `is_approved` on the configured `compliance-engine` and `kyc-registry` contracts.
   - **Boundary Assumption:** The `kyc_registry` and `compliance_engine` contract IDs passed to `initialize` are immutable once initialized (`AlreadyInitialized` error prevents re-initialization). Deploying operators must verify that all asset contracts point to the intended registry and compliance engine on the target network.
2. **Off-Chain KYC Boundary:**
   - Smart contracts cannot verify whether an off-chain identity document is authentic. On-chain checks only verify that an address in `VerifierList` signed `approve_kyc` and that `record.expiry == 0 || env.ledger().timestamp() < record.expiry`.

---

## 4. Protected Invariants & Source-Checked Controls

1. **Single Initialization Guard:**
   - Every contract checks `env.storage().instance().has(&DataKey::Admin)` in `initialize` and aborts with `AlreadyInitialized` (`kyc-registry/src/lib.rs:77`, `compliance-engine/src/lib.rs:57`), preventing admin takeover via re-initialization.
2. **Two-Step Admin Handover:**
   - Admin rotation requires the current `Admin` to call `propose_admin(new_admin)` and the proposed `PendingAdmin` to explicitly sign `accept_admin()` (`kyc-registry/src/lib.rs:84-111`, `compliance-engine/src/lib.rs:78-103`), preventing accidental transfer to an unowned or mistyped address.
3. **Fail-Closed Transfer Compliance:**
   - Transfers fail closed whenever:
     - The contract or compliance engine is paused (`rules.paused == true`).
     - Either party is on `DataKey::Blocklist` or in `DataKey::BlockedJurisdictions`.
     - Either party lacks `KycStatus::Approved` or has an expired KYC record (`expiry > 0 && now >= expiry`).
     - `amount > rules.max_transfer_amount` (when `max_transfer_amount > 0`).
     - Sender holding duration is below `rules.min_holding_period`.
     - Adding a new recipient would exceed `rules.max_holders` (when `max_holders > 0`).
4. **Conservation of Supply & Checked Arithmetic:**
   - `rwa-token`, `invoice-token`, `property-token`, and `carbon-credit-token` reject negative or zero transfer/mint amounts and validate balance/allowance sufficiency before debiting and crediting balances.
   - Clippy lint `#![cfg_attr(not(test), deny(clippy::unwrap_used))]` is enforced across contract crates.

---

## 5. Known Operational, Storage TTL, and Upgrade Limitations

1. **No In-Place WASM Upgrade Hook:**
   - The contracts do not expose an `update_current_contract_wasm` entrypoint. Updating contract logic requires deploying a new contract instance and migrating state off-chain or re-issuing positions.
2. **Soroban Storage TTL & Archival:**
   - Contracts extend instance and persistent storage TTL (`extend_ttl(THRESHOLD, BUMP)` with a 30-day bump window) during active calls. If a contract or holder entry is inactive beyond its TTL, Soroban archives the entry until a restoration transaction (`stellar contract restore`) is submitted.
3. **Unbounded Vector Growth in Instance Storage:**
   - `VerifierList`, `Blocklist`, and `BlockedJurisdictions` are stored as `Vec<Address>` / `Vec<String>` in instance storage. Operators should keep these lists bounded so instance storage stays well within Soroban ledger entry byte and CPU budget limits.