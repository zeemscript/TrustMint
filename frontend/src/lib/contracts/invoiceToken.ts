/**
 * Typed client for the invoice-token Soroban contract.
 *
 * Contract functions covered:
 *   Read:  get_meta, name, symbol, decimals, balance, total_supply, is_settled, allowance
 *   Write: issue, settle, redeem, transfer, transfer_from, approve
 */

import { nativeToScVal, type rpc, xdr } from "@stellar/stellar-sdk";
import type { InvoiceMeta } from "../../types";
import {
  readCall,
  writeCall,
  fetchSequence,
  toAddress,
  toI128,
  toU32,
  toString,
  type SignTx,
} from "./base";

function encodeInvoiceMeta(meta: InvoiceMeta): xdr.ScVal {
  return nativeToScVal(
    {
      invoice_id: meta.invoice_id,
      issuer: meta.issuer,
      debtor: meta.debtor,
      face_value_usd: meta.face_value_usd,
      discount_rate_bps: meta.discount_rate_bps,
      due_date: meta.due_date,
      currency: meta.currency,
      ipfs_doc_hash: meta.ipfs_doc_hash,
      transfer_fee_bps: meta.transfer_fee_bps ?? 0,
      fee_recipient: meta.fee_recipient ?? null,
    },
    {
      type: {
        invoice_id: ["string"],
        issuer: ["string"],
        debtor: ["string"],
        face_value_usd: ["i128"],
        discount_rate_bps: ["u32"],
        due_date: ["u64"],
        currency: ["string"],
        ipfs_doc_hash: ["string"],
        transfer_fee_bps: ["u32"],
        fee_recipient: ["option", "address"],
      },
    },
  );
}

export class InvoiceTokenClient {
  constructor(
    private readonly contractId: string,
    private readonly server: rpc.Server
  ) {}

  // ── Read methods ──────────────────────────────────────────────────────────

  /** Returns metadata for an invoice ID. */
  async getMeta(invoiceId: string): Promise<InvoiceMeta> {
    return readCall<InvoiceMeta>(this.server, this.contractId, "get_meta", [
      toString(invoiceId),
    ]);
  }

  async listInvoices(start = 0, limit = 50): Promise<string[]> {
    return readCall<string[]>(this.server, this.contractId, "list_invoices", [
      toU32(start),
      toU32(limit),
    ]);
  }

  /** Returns the token name. */
  async name(): Promise<string> {
    return readCall<string>(this.server, this.contractId, "name", []);
  }

  /** Returns the token symbol. */
  async symbol(): Promise<string> {
    return readCall<string>(this.server, this.contractId, "symbol", []);
  }

  /** Returns the decimal precision (7 for invoice tokens). */
  async decimals(): Promise<number> {
    return readCall<number>(this.server, this.contractId, "decimals", []);
  }

  /** Returns the token balance of `addr`. */
  async balance(invoiceId: string, addr: string): Promise<bigint> {
    return readCall<bigint>(this.server, this.contractId, "balance", [
      toAddress(addr),
      toString(invoiceId),
    ]);
  }

  /** Returns the current total supply. */
  async totalSupply(invoiceId: string): Promise<bigint> {
    return readCall<bigint>(
      this.server,
      this.contractId,
      "total_supply",
      [toString(invoiceId)]
    );
  }

  /** Returns true when the invoice has been settled and redemption is open. */
  async isSettled(invoiceId: string): Promise<boolean> {
    return readCall<boolean>(
      this.server,
      this.contractId,
      "is_settled",
      [toString(invoiceId)]
    );
  }

  /** Returns the current allowance granted by `from` to `spender`. */
  async allowance(invoiceId: string, from: string, spender: string): Promise<bigint> {
    return readCall<bigint>(this.server, this.contractId, "allowance", [
      toAddress(from),
      toAddress(spender),
      toString(invoiceId),
    ]);
  }

  // ── Write methods ─────────────────────────────────────────────────────────

  /** Create a new invoice record. Admin-only on-chain. */
  async createInvoice(
    adminAddress: string,
    meta: InvoiceMeta,
    signTx: SignTx,
  ): Promise<void> {
    const seq = await fetchSequence(this.server, adminAddress);
    return writeCall(
      this.server,
      this.contractId,
      "create_invoice",
      [encodeInvoiceMeta(meta)],
      adminAddress,
      seq,
      signTx,
    );
  }

  /** Mint invoice tokens to `to`. Admin-only on-chain. */
  async issue(
    adminAddress: string,
    invoiceId: string,
    to: string,
    amount: bigint,
    signTx: SignTx
  ): Promise<void> {
    const seq = await fetchSequence(this.server, adminAddress);
    return writeCall(
      this.server,
      this.contractId,
      "issue",
      [toString(invoiceId), toAddress(to), toI128(amount)],
      adminAddress,
      seq,
      signTx
    );
  }

  /** Mark the invoice as settled and open redemption. Admin-only on-chain. */
  async settle(adminAddress: string, invoiceId: string, signTx: SignTx): Promise<void> {
    const seq = await fetchSequence(this.server, adminAddress);
    return writeCall(
      this.server,
      this.contractId,
      "settle",
      [toString(invoiceId)],
      adminAddress,
      seq,
      signTx
    );
  }

  /** Burn `amount` tokens upon redemption. Requires invoice to be settled. */
  async redeem(
    invoiceId: string,
    fromAddress: string,
    amount: bigint,
    signTx: SignTx
  ): Promise<void> {
    const seq = await fetchSequence(this.server, fromAddress);
    return writeCall(
      this.server,
      this.contractId,
      "redeem",
      [toString(invoiceId), toAddress(fromAddress), toI128(amount)],
      fromAddress,
      seq,
      signTx
    );
  }

  /** Transfer `amount` tokens from `from` to `to`. Requires `from`'s auth. */
  async transfer(
    invoiceId: string,
    fromAddress: string,
    to: string,
    amount: bigint,
    signTx: SignTx
  ): Promise<void> {
    const seq = await fetchSequence(this.server, fromAddress);
    return writeCall(
      this.server,
      this.contractId,
      "transfer",
      [toString(invoiceId), toAddress(fromAddress), toAddress(to), toI128(amount)],
      fromAddress,
      seq,
      signTx
    );
  }

  /** Transfer using a pre-approved allowance. Requires `spender`'s auth. */
  async transferFrom(
    invoiceId: string,
    spenderAddress: string,
    from: string,
    to: string,
    amount: bigint,
    signTx: SignTx
  ): Promise<void> {
    const seq = await fetchSequence(this.server, spenderAddress);
    return writeCall(
      this.server,
      this.contractId,
      "transfer_from",
      [toAddress(spenderAddress), toString(invoiceId), toAddress(from), toAddress(to), toI128(amount)],
      spenderAddress,
      seq,
      signTx
    );
  }

  /**
   * Grant `spender` an allowance of `amount` expiring at `expirationLedger`.
   * Requires `fromAddress`'s auth.
   */
  async approve(
    invoiceId: string,
    fromAddress: string,
    spender: string,
    amount: bigint,
    expirationLedger: number,
    signTx: SignTx
  ): Promise<void> {
    const seq = await fetchSequence(this.server, fromAddress);
    return writeCall(
      this.server,
      this.contractId,
      "approve",
      [toAddress(fromAddress), toAddress(spender), toString(invoiceId), toI128(amount), toU32(expirationLedger)],
      fromAddress,
      seq,
      signTx
    );
  }
}

