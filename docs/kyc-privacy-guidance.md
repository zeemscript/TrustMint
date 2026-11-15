# Operator & Developer Privacy Guidance for Off-Chain KYC Information

TrustMint separates **on-chain eligibility attestations** from **off-chain identity verification**. This document defines what data is recorded publicly on the Stellar Soroban ledger, how browser environment variables are exposed in the Vite dashboard, and the data-minimization and compliance responsibilities of any operator deploying or integrating TrustMint.

> **Disclaimer:** TrustMint is an unaudited open-source Soroban starter kit. It does not perform identity verification, store personal data, or provide legal/regulatory compliance (such as GDPR, CCPA, MiCA, or BSA/AML compliance). Deploying teams are solely responsible for their off-chain KYC/AML procedures, privacy notices, data retention policies, and legal obligations.

---

## 1. Public On-Chain Ledger Fields and Events

Everything written to Soroban contract storage or emitted via `env.events().publish(...)` is **publicly readable, globally replicated, and permanently indexed** by Stellar RPC nodes, Horizon archivers, and block explorers.

### 1.1 `kyc-registry` (`contracts/kyc-registry/src/lib.rs`)

- **Persistent/Instance Storage (`DataKey`):**
  - `DataKey::KycStatus(Address)` stores a `KycRecord`:
    - `status`: `KycStatus` (`Pending`, `Approved`, `Rejected`, `Revoked`)
    - `verifier`: `Address` (Stellar public key `G...` of the verifier that recorded the decision)
    - `tier`: `u32` (`0` = basic, `1` = accredited, `2` = institutional)
    - `expiry`: `u64` (ledger unix timestamp; `0` = no expiry)
    - `jurisdiction`: `String` (2-letter ISO-3166-1 alpha-2 country code, e.g. `"US"`, `"NG"`, `"GB"`)
  - `DataKey::ExpiryIndex(u32)` stores `ExpiryEntry { expiry: u64, addr: Address }`.
- **Published Contract Events:**
  - `("proposed",)` -> `new_admin: Address`
  - `("admin_set",)` -> `(old_admin: Address, new_admin: Address)`
  - `("add_vrf",)` / `("rem_vrf",)` -> `verifier: Address`
  - `("kyc_aprv", addr)` -> `(verifier: Address, tier: u32)`
  - `("kyc_rej", addr)` / `("kyc_rev", addr)` -> `verifier: Address`

### 1.2 `compliance-engine` and Asset Contracts (`invoice-token`, `property-token`, `carbon-credit-token`, `rwa-token`)

- **Blocklists & Holder Tracking:** `DataKey::Blocklist` (`Vec<Address>`), `DataKey::BlockedJurisdictions` (`Vec<String>`), and `DataKey::HolderSince(Address)` (`u64` timestamp) are public on-chain state.
- **Asset Metadata (`InvoiceMeta`, `PropertyMeta`, `ProjectMeta`, `RetirementReceipt`):**
  - Fields such as `legal_name`, `address`, `ipfs_doc_hash`, `ipfs_title_hash`, `ipfs_cert_hash`, `beneficiary`, and `retirement_reason` are public on-chain strings.
  - **Never** embed unencrypted personal identity documents, government ID numbers, tax IDs, bank account numbers, residential addresses of individuals, or raw KYC dossiers in contract metadata or IPFS hashes pinned without access control.

---

## 2. Data Minimization Rules for Operators and Verifiers

1. **Keep PII 100% Off-Chain:**
   - Passports, national IDs, selfies, proof-of-address documents, sanctions screening logs, and legal entity beneficial-ownership files must remain in an access-controlled, encrypted off-chain system operated by your KYC provider.
2. **Record Only Minimal Eligibility Signals On-Chain:**
   - Only record the minimal `KycRecord` fields (`status`, `tier`, `expiry`, and 2-letter `jurisdiction`) required by `compliance-engine` to evaluate transfers.
3. **Avoid Correlation & Linkability Risks:**
   - Because `KycStatus(Address)` maps a Stellar public address (`G...`) to a `tier` and 2-letter `jurisdiction` on a public ledger, operators should inform users before submitting on-chain KYC approvals and recommend dedicated Stellar accounts rather than personal everyday wallets where appropriate.
4. **Right to Erasure / Revocation:**
   - On-chain historical ledger archives cannot be retroactively erased. Calling `revoke_kyc` updates current contract state to `KycStatus::Revoked`, preventing future compliant transfers, but historical transactions and events remain visible in ledger history. Never place personal data on-chain that could be subject to erasure requests.

---

## 3. Vite Frontend Environment Variable Exposure (`frontend/.env`)

The React dashboard in `frontend/` is built with **Vite**, which statically embeds every environment variable prefixed with `VITE_` into the client-side JavaScript bundle served to every browser visitor.

### What Is Safe in `frontend/.env`

- Public network selection (`VITE_STELLAR_NETWORK=testnet`)
- Public Soroban contract addresses (`C...` for `VITE_KYC_REGISTRY_ID`, `VITE_COMPLIANCE_ENGINE_ID`, `VITE_INVOICE_TOKEN_ID`, `VITE_PROPERTY_TOKEN_ID`, `VITE_CARBON_TOKEN_ID`, `VITE_RWA_TOKEN_ID`)

### What Must NEVER Be Placed in `frontend/.env` or Frontend Code

- Stellar secret keys (`S...`), recovery seed phrases / mnemonics, or admin/verifier signing keys
- Third-party KYC vendor API keys, webhook secrets, or database connection strings
- Customer PII, applicant names, email addresses, or document URLs

All privileged admin and verifier transactions in the dashboard must be signed interactively via an injected user wallet (such as Freighter) controlled by the authorized operator.