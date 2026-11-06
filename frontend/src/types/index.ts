export type AssetType = "invoice" | "property" | "carbon_credit";

export type KycStatus = "Pending" | "Approved" | "Rejected" | "Revoked";

export interface KycRecord {
  status: KycStatus;
  verifier: string;
  tier: number;
  expiry: number;
  jurisdiction: string;
}

export interface InvoiceMeta {
  invoice_id: string;
  issuer: string;
  debtor: string;
  face_value_usd: bigint;
  discount_rate_bps: number;
  due_date: number;
  currency: string;
  ipfs_doc_hash: string;
  transfer_fee_bps?: number;
  fee_recipient?: string | null;
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
  timestamp: number;
  beneficiary: string;
  retirement_reason: string;
}

export interface ContractEvent {
  type: string;
  amount: string;
  counterparty: string;
  timestamp: string;
}

export interface ComplianceRules {
  max_transfer_amount: bigint;
  min_holding_period: number;
  max_holders: number;
  require_same_jurisdiction: boolean;
  paused: boolean;
}

export interface ContractEvent {
  type: string;
  amount: string;
  counterparty: string;
  timestamp: string;
}

export interface WalletState {
  address: string | null;
  network: string;
  connected: boolean;
}
