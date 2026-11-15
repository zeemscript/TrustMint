export type KycStatus = "Pending" | "Approved" | "Rejected" | "Revoked";

export interface KycRecord {
  status: KycStatus;
  verifier: string;
  tier: number;
  expiry: bigint;
  jurisdiction: string;
}

export interface InvoiceMeta {
  invoice_id: string;
  issuer: string;
  debtor: string;
  face_value_usd: bigint;
  discount_rate_bps: number;
  due_date: bigint;
  currency: string;
  ipfs_doc_hash: string;
  transfer_fee_bps: number;
  fee_recipient: string | null;
}

export interface PropertyMeta {
  property_id: string;
  legal_name: string;
  jurisdiction: string;
  address: string;
  total_valuation_usd: bigint;
  total_shares: bigint;
  property_type: string;
  ipfs_title_hash: string;
  kyc_tier_required: number;
}

export interface ProjectMeta {
  project_id: string;
  standard: string;
  vintage_year: number;
  project_name: string;
  project_type: string;
  country: string;
  verifier: string;
  ipfs_cert_hash: string;
}

export interface RetirementReceipt {
  retiree: string;
  amount: bigint;
  timestamp: bigint;
  beneficiary: string;
  retirement_reason: string;
}

export interface ComplianceRules {
  max_transfer_amount: bigint;
  min_holding_period: bigint;
  max_holders: number;
  require_same_jurisdiction: boolean;
  paused: boolean;
}

export type Network = "testnet" | "mainnet" | "local";

export interface ServerConfigOptions {
  /** Target Stellar network preset ("testnet", "mainnet", or "local"). */
  network: Network;
  /** Optional custom Soroban RPC endpoint URL (e.g. local Quickstart or dedicated RPC provider). */
  rpcUrl?: string;
  /** Optional explicit network passphrase; when provided, must match the declared network preset. */
  networkPassphrase?: string;
  /** Allow plain HTTP RPC endpoints (enabled automatically for localhost/127.0.0.1 on "local"). */
  allowHttp?: boolean;
}

export interface ResolvedNetworkConfig {
  network: Network;
  rpcUrl: string;
  networkPassphrase: string;
  allowHttp: boolean;
}