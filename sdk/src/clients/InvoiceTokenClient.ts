import { Address, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import { BaseContractClient, scVal } from "./base.js";
import type { InvoiceMeta } from "../types.js";

export class InvoiceTokenClient extends BaseContractClient {
  constructor(contractId: string, server: rpc.Server, networkPassphrase: string) {
    super(contractId, server, networkPassphrase);
  }

  // ── Read API ─────────────────────────────────────────────────────────────

  async getMeta(invoiceId: string): Promise<InvoiceMeta> {
    return scVal<InvoiceMeta>(await this.simulate("get_meta", [
      nativeToScVal(invoiceId, { type: "string" }),
    ]));
  }

  async listInvoices(start = 0, limit = 50): Promise<string[]> {
    return scVal<string[]>(await this.simulate("list_invoices", [
      nativeToScVal(start, { type: "u32" }),
      nativeToScVal(limit, { type: "u32" }),
    ]));
  }

  async balance(invoiceId: string, addr: string): Promise<bigint> {
    return scVal<bigint>(
      await this.simulate("balance", [new Address(addr).toScVal(), nativeToScVal(invoiceId, { type: "string" })]),
    );
  }

  async totalSupply(invoiceId: string): Promise<bigint> {
    return scVal<bigint>(await this.simulate("total_supply", [nativeToScVal(invoiceId, { type: "string" })]));
  }

  async isSettled(invoiceId: string): Promise<boolean> {
    return scVal<boolean>(await this.simulate("is_settled", [nativeToScVal(invoiceId, { type: "string" })]));
  }

  async allowance(invoiceId: string, from: string, spender: string): Promise<bigint> {
    return scVal<bigint>(
      await this.simulate("allowance", [
        new Address(from).toScVal(),
        new Address(spender).toScVal(),
        nativeToScVal(invoiceId, { type: "string" }),
      ]),
    );
  }

  async name(): Promise<string> {
    return scVal<string>(await this.simulate("name", []));
  }

  async symbol(): Promise<string> {
    return scVal<string>(await this.simulate("symbol", []));
  }

  async decimals(): Promise<number> {
    return scVal<number>(await this.simulate("decimals", []));
  }

  // ── Transaction builders (return operation XDR for signing) ───────────────

  buildCreateInvoiceXdr(meta: InvoiceMeta): string {
    return this.buildCallXdr("create_invoice", [nativeToScVal(meta)]);
  }

  buildIssueXdr(invoiceId: string, to: string, amount: bigint): string {
    return this.buildCallXdr("issue", [
      nativeToScVal(invoiceId, { type: "string" }),
      new Address(to).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ]);
  }

  buildSettleXdr(invoiceId: string): string {
    return this.buildCallXdr("settle", [nativeToScVal(invoiceId, { type: "string" })]);
  }

  buildRedeemXdr(invoiceId: string, from: string, amount: bigint): string {
    return this.buildCallXdr("redeem", [
      nativeToScVal(invoiceId, { type: "string" }),
      new Address(from).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ]);
  }

  buildTransferXdr(invoiceId: string, from: string, to: string, amount: bigint): string {
    return this.buildCallXdr("transfer", [
      nativeToScVal(invoiceId, { type: "string" }),
      new Address(from).toScVal(),
      new Address(to).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ]);
  }

  buildTransferFromXdr(
    invoiceId: string,
    spender: string,
    from: string,
    to: string,
    amount: bigint,
  ): string {
    return this.buildCallXdr("transfer_from", [
      new Address(spender).toScVal(),
      nativeToScVal(invoiceId, { type: "string" }),
      new Address(from).toScVal(),
      new Address(to).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ]);
  }

  buildApproveXdr(
    invoiceId: string,
    from: string,
    spender: string,
    amount: bigint,
    expirationLedger: number,
  ): string {
    return this.buildCallXdr("approve", [
      new Address(from).toScVal(),
      new Address(spender).toScVal(),
      nativeToScVal(invoiceId, { type: "string" }),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(expirationLedger, { type: "u32" }),
    ]);
  }

  buildUpdateMetaXdr(invoiceId: string, meta: InvoiceMeta): string {
    return this.buildCallXdr("update_meta", [
      nativeToScVal(invoiceId, { type: "string" }),
      nativeToScVal(meta),
    ]);
  }
}
