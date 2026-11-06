import { Networks, TransactionBuilder, rpc, scValToNative } from "@stellar/stellar-sdk";
import { useNetworkStore, getNetworkRpcUrl } from "./networkStore";
import type { ContractEvent } from "../types";

export const getNetwork = () => useNetworkStore.getState().network;

export const getRpcUrl = () => {
  const network = getNetwork();
  return getNetworkRpcUrl(network);
};

export const getNetworkPassphrase = () => {
  const network = getNetwork();
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
};

export const getServer = () => new rpc.Server(getRpcUrl(), { allowHttp: false });

// For backwards compatibility, export these as functions that return the current values
export const NETWORK = getNetwork();
export const RPC_URL = getRpcUrl();
export const NETWORK_PASSPHRASE = getNetworkPassphrase();
export const server = getServer();

export const CONTRACT_IDS = {
  kycRegistry: import.meta.env.VITE_KYC_REGISTRY_ID ?? "",
  complianceEngine: import.meta.env.VITE_COMPLIANCE_ENGINE_ID ?? "",
  invoiceToken: import.meta.env.VITE_INVOICE_TOKEN_ID ?? "",
  propertyToken: import.meta.env.VITE_PROPERTY_TOKEN_ID ?? "",
  carbonToken: import.meta.env.VITE_CARBON_TOKEN_ID ?? "",
  rwaToken: import.meta.env.VITE_RWA_TOKEN_ID ?? "",
};

// Error code tables matching each contract's #[contracterror] enum discriminants.
const KYC_ERRORS: Record<number, string> = {
  1: "Contract already initialized",
  2: "Not an authorized verifier",
  3: "KYC not approved",
  4: "No KYC record found",
};

const COMPLIANCE_ERRORS: Record<number, string> = {
  1: "Contract already initialized",
};

const INVOICE_ERRORS: Record<number, string> = {
  1: "Contract already initialized",
  2: "Invoice already settled",
  3: "Invoice not yet settled",
  4: "Insufficient balance",
  5: "Negative amount",
  6: "Insufficient allowance",
  7: "Allowance expired",
  8: "KYC not approved",
  9: "Redemption blocked: compliance paused",
  10: "Redemption blocked: holder is blocklisted",
  11: "Transfer blocked by compliance engine",
};

const RWA_ERRORS: Record<number, string> = {
  1: "Contract already initialized",
  2: "KYC not approved",
  3: "Transfer blocked by compliance engine",
  4: "Insufficient balance",
  5: "Allowance expiration ledger is in the past",
  6: "Insufficient allowance",
};

const PROPERTY_ERRORS: Record<number, string> = {
  1: "Contract already initialized",
  2: "Shares must be positive",
  3: "Insufficient shares",
  4: "No shares issued",
  5: "KYC not approved",
  6: "KYC tier below property requirement",
  7: "Mint blocked: compliance paused",
  8: "Mint recipient is blocklisted",
  9: "Transfer blocked by compliance engine",
};

const CARBON_ERRORS: Record<number, string> = {
  1: "Contract already initialized",
  2: "Insufficient balance",
  3: "KYC not approved",
  4: "Mint blocked: compliance paused",
  5: "Mint recipient is blocklisted",
  6: "Transfer blocked by compliance engine",
};

type ContractType =
  | "kyc"
  | "compliance"
  | "invoice"
  | "rwa"
  | "property"
  | "carbon";

const ERROR_TABLES: Record<ContractType, Record<number, string>> = {
  kyc: KYC_ERRORS,
  compliance: COMPLIANCE_ERRORS,
  invoice: INVOICE_ERRORS,
  rwa: RWA_ERRORS,
  property: PROPERTY_ERRORS,
  carbon: CARBON_ERRORS,
};

/**
 * Decodes a numeric Soroban contract error code into a human-readable message.
 * The contractType identifies which contract's error table to look up.
 */
export function decodeContractError(
  contractType: ContractType,
  code: number,
): string {
  return (
    ERROR_TABLES[contractType]?.[code] ??
    `Unknown contract error (type=${contractType}, code=${code})`
  );
}

export async function simulateAndSend(
  xdr: string,
  signTx: (xdr: string) => Promise<string>,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const simResult = await server.simulateTransaction(
    TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE),
  );

  if (rpc.Api.isSimulationError(simResult)) {
    const errorMsg = simResult.error;
    // Attempt to extract a numeric error code from the simulation error string.
    const codeMatch = errorMsg.match(/\(code=(\d+)\)/);
    if (codeMatch) {
      const code = parseInt(codeMatch[1], 10);
      throw new Error(`Contract error: ${decodeContractError("rwa", code)}`);
    }
    throw new Error(`Simulation failed: ${errorMsg}`);
  }

  const prepared = rpc
    .assembleTransaction(
      TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE),
      simResult,
    )
    .build()
    .toXDR();

  const signed = await signTx(prepared);
  const result = await server.sendTransaction(
    TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE),
  );

  if (result.status === "ERROR") {
    throw new Error(
      `Transaction failed: ${JSON.stringify(result.errorResult)}`,
    );
  }

  // Poll for confirmation
  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status !== "SUCCESS") {
    throw new Error(`Transaction not successful: ${getResult.status}`);
  }

  return getResult as rpc.Api.GetSuccessfulTransactionResponse;
}

/** Fetch recent Soroban contract events and normalize them for the dashboard. */
export async function fetchContractEvents(
  contractId: string,
  limit: number = 10,
): Promise<ContractEvent[]> {
  const latest = await server.getLatestLedger();
  const response = await server.getEvents({
    startLedger: Math.max(1, latest.sequence - 10_000),
    filters: [{ type: "contract", contractIds: [contractId] }],
    limit: Math.min(Math.max(limit, 1), 100),
  });

  return response.events.slice().reverse().map((event) => {
    const topicValues = event.topic.map((topic) => {
      try {
        return String(scValToNative(topic));
      } catch {
        return topic.toXDR("base64");
      }
    });
    let amount = "";
    try {
      const value = scValToNative(event.value);
      amount = typeof value === "object" && value !== null && "amount" in value
        ? String((value as { amount: unknown }).amount)
        : String(value);
    } catch {
      amount = event.value.toXDR("base64");
    }

    return {
      type: topicValues[0] ?? "event",
      amount,
      counterparty: topicValues[topicValues.length > 1 ? 1 : 0] ?? "",
      timestamp: event.ledgerClosedAt,
    };
  });
}
