import { useState, useEffect } from "react";
import { useWallet } from "../lib/wallet";
import { contracts } from "../lib/contracts";
import { CONTRACT_IDS, fetchContractEvents } from "../lib/stellar";
import { useAmountValidation } from "../lib/validation";
import { PageHeader, Card, Field, Icon } from "../components/ui";
import WalletGuard from "../components/WalletGuard";
import { useToast } from "../lib/toast";
import type { ContractEvent } from "../types";

export default function InvoicePage() {
  const { address, signTx } = useWallet();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    invoice_id: "",
    issuer: "",
    debtor: "",
    face_value_usd: "",
    discount_rate_bps: "0",
    due_date: "",
    currency: "USD",
    ipfs_doc_hash: "",
  });
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Amount validations
  const faceValueValidation = useAmountValidation(form.face_value_usd);
  const discountRateValidation = useAmountValidation(form.discount_rate_bps);

  useEffect(() => {
    if (!CONTRACT_IDS.invoiceToken) return;
    setEventsLoading(true);
    fetchContractEvents(CONTRACT_IDS.invoiceToken, 10)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faceValueValidation.isValid) {
      addToast(faceValueValidation.error || "Invalid face value", "error");
      return;
    }
    if (form.discount_rate_bps && !discountRateValidation.isValid) {
      addToast(
        discountRateValidation.error || "Invalid discount rate",
        "error",
      );
      return;
    }
    if (!address) return;
    if (!form.invoice_id.trim() || !form.issuer.trim() || !form.debtor.trim()) {
      addToast("Invoice ID, issuer, and debtor are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const faceValue = BigInt(Math.round(Number(form.face_value_usd) * 10_000_000));
      const dueDate = Math.floor(new Date(`${form.due_date}T00:00:00Z`).getTime() / 1000);
      if (!Number.isFinite(dueDate) || dueDate <= 0) {
        addToast("Enter a valid due date", "error");
        return;
      }
      const meta = {
        invoice_id: form.invoice_id.trim(),
        issuer: form.issuer.trim(),
        debtor: form.debtor.trim(),
        face_value_usd: faceValue,
        discount_rate_bps: Number(form.discount_rate_bps || 0),
        due_date: dueDate,
        currency: form.currency.trim().toUpperCase(),
        ipfs_doc_hash: form.ipfs_doc_hash.trim(),
        transfer_fee_bps: 0,
        fee_recipient: null,
      };
      await contracts.invoice.createInvoice(address, meta, signTx);
      await contracts.invoice.issue(address, meta.invoice_id, address, faceValue, signTx);
      addToast(`Invoice ${form.invoice_id} created and issued successfully.`, "success");
      setForm({
        invoice_id: "",
        issuer: "",
        debtor: "",
        face_value_usd: "",
        discount_rate_bps: "0",
        due_date: "",
        currency: "USD",
        ipfs_doc_hash: "",
      });
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to tokenize invoice.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasFaceValueError =
    form.face_value_usd.length > 0 && !faceValueValidation.isValid;
  const hasDiscountRateError =
    form.discount_rate_bps.length > 0 && !discountRateValidation.isValid;

  return (
    <div className="form-narrow">
      <PageHeader
        eyebrow="Asset Module"
        icon={<Icon.invoice size={22} />}
        title="Invoice Token"
        description="Tokenize an accounts-receivable invoice. Each token unit represents one stroop (10⁻⁷ USD) of face value."
      />
      <WalletGuard>
        <Card>
          <form onSubmit={handleIssue}>
            <Field
              label="Invoice ID"
              name="invoice_id"
              value={form.invoice_id}
              onChange={handleChange}
              required
            />
            <Field
              label="Issuer (company name)"
              name="issuer"
              value={form.issuer}
              onChange={handleChange}
              required
            />
            <Field
              label="Debtor (buyer name)"
              name="debtor"
              value={form.debtor}
              onChange={handleChange}
              required
            />
            <Field
              label="Face Value (USD)"
              name="face_value_usd"
              type="number"
              value={form.face_value_usd}
              onChange={handleChange}
              required
              error={faceValueValidation.error}
            />
            <Field
              label="Discount Rate (bps)"
              name="discount_rate_bps"
              type="number"
              value={form.discount_rate_bps}
              onChange={handleChange}
              error={discountRateValidation.error}
            />
            <Field
              label="Due Date"
              name="due_date"
              type="date"
              value={form.due_date}
              onChange={handleChange}
              required
            />
            <Field
              label="Currency"
              name="currency"
              value={form.currency}
              onChange={handleChange}
            />
            <Field
              label="IPFS Document Hash"
              name="ipfs_doc_hash"
              value={form.ipfs_doc_hash}
              onChange={handleChange}
              placeholder="bafyrei…"
            />
            <button
              type="submit"
              className="btn-block"
              style={{ marginTop: "0.75rem" }}
              disabled={hasFaceValueError || hasDiscountRateError}
            >
              {submitting ? "Submitting…" : "Create and Issue Invoice"}
            </button>
          </form>
        </Card>
      </WalletGuard>

      <RecentTransactions events={events} loading={eventsLoading} />
    </div>
  );
}

function RecentTransactions({
  events,
  loading,
}: {
  events: ContractEvent[];
  loading: boolean;
}) {
  return (
    <Card title="Recent Transactions" style={{ marginTop: "1.25rem" }}>
      {loading ? (
        <p className="muted" style={{ fontSize: "0.875rem" }}>
          Loading…
        </p>
      ) : events.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.875rem" }}>
          No recent events found.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.82rem",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border)",
                textAlign: "left",
              }}
            >
              <th style={th}>Type</th>
              <th style={th}>Amount</th>
              <th style={th}>Counterparty</th>
              <th style={th}>Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}>{ev.type}</td>
                <td style={td}>{ev.amount}</td>
                <td
                  style={{
                    ...td,
                    fontFamily: "monospace",
                    maxWidth: 140,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ev.counterparty}
                </td>
                <td style={td}>{ev.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

const th: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  fontWeight: 600,
  color: "var(--muted)",
};
const td: React.CSSProperties = { padding: "0.4rem 0.5rem" };
