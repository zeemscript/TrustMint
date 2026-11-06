import { useState, useEffect } from "react";
import { useWallet } from "../lib/wallet";
import { contracts } from "../lib/contracts";
import { CONTRACT_IDS, fetchContractEvents } from "../lib/stellar";
import { useAmountValidation } from "../lib/validation";
import { PageHeader, Card, Field, Select, Icon } from "../components/ui";
import WalletGuard from "../components/WalletGuard";
import { useToast } from "../lib/toast";
import type { ContractEvent } from "../types";

export default function PropertyPage() {
  const { address, signTx } = useWallet();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    property_id: "",
    legal_name: "",
    jurisdiction: "",
    address: "",
    total_valuation_usd: "",
    total_shares: "1000000",
    property_type: "residential",
    ipfs_title_hash: "",
    kyc_tier_required: "1",
  });
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Amount validations
  const valuationValidation = useAmountValidation(form.total_valuation_usd);
  const sharesValidation = useAmountValidation(form.total_shares);

  useEffect(() => {
    if (!CONTRACT_IDS.propertyToken) return;
    setEventsLoading(true);
    fetchContractEvents(CONTRACT_IDS.propertyToken, 10)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleTokenize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valuationValidation.isValid) {
      addToast(valuationValidation.error || "Invalid valuation", "error");
      return;
    }
    if (!sharesValidation.isValid) {
      addToast(sharesValidation.error || "Invalid share count", "error");
      return;
    }
    if (!address) return;
    setSubmitting(true);
    try {
      // Property metadata is fixed by the deployed contract constructor. This
      // action issues shares for the connected, KYC-approved holder.
      await contracts.property.mint(address, address, BigInt(form.total_shares), signTx);
      addToast(`Issued ${form.total_shares} shares to the connected wallet.`, "success");
      setForm({
        property_id: "",
        legal_name: "",
        jurisdiction: "",
        address: "",
        total_valuation_usd: "",
        total_shares: "1000000",
        property_type: "residential",
        ipfs_title_hash: "",
        kyc_tier_required: "1",
      });
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to tokenize property.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasValuationError =
    form.total_valuation_usd.length > 0 && !valuationValidation.isValid;
  const hasSharesError =
    form.total_shares.length > 0 && !sharesValidation.isValid;

  return (
    <div className="form-narrow">
      <PageHeader
        eyebrow="Asset Module"
        icon={<Icon.property size={22} />}
        title="Property Shares"
        description="Issue shares from the deployed property contract. Property metadata is fixed at deployment, while ownership and pro-rata dividends are managed on-chain."
      />
      <WalletGuard>
        <Card>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
            The connected wallet must be the property admin and an approved holder. The deployed contract’s metadata is not changed by this form; the share count below is the on-chain action.
          </p>
          <form onSubmit={handleTokenize}>
            <Field
              label="Property ID (internal)"
              name="property_id"
              value={form.property_id}
              onChange={handleChange}
              required
            />
            <Field
              label="Legal Name"
              name="legal_name"
              value={form.legal_name}
              onChange={handleChange}
              required
            />
            <Field
              label="Jurisdiction"
              name="jurisdiction"
              value={form.jurisdiction}
              onChange={handleChange}
              required
            />
            <Field
              label="Physical Address"
              name="address"
              value={form.address}
              onChange={handleChange}
              required
            />
            <Field
              label="Total Valuation (USD)"
              name="total_valuation_usd"
              type="number"
              value={form.total_valuation_usd}
              onChange={handleChange}
              required
              error={valuationValidation.error}
            />
            <Field
              label="Total Shares to Issue"
              name="total_shares"
              type="number"
              value={form.total_shares}
              onChange={handleChange}
              required
              error={sharesValidation.error}
            />
            <Select
              label="Property Type"
              name="property_type"
              value={form.property_type}
              onChange={handleChange}
              options={[
                { value: "residential", label: "Residential" },
                { value: "commercial", label: "Commercial" },
                { value: "land", label: "Land" },
              ]}
            />
            <Field
              label="IPFS Title Hash"
              name="ipfs_title_hash"
              value={form.ipfs_title_hash}
              onChange={handleChange}
              placeholder="bafyrei…"
            />
            <Select
              label="Min KYC Tier Required"
              name="kyc_tier_required"
              value={form.kyc_tier_required}
              onChange={handleChange}
              options={[
                { value: "0", label: "0 — Basic" },
                { value: "1", label: "1 — Accredited" },
                { value: "2", label: "2 — Institutional" },
              ]}
            />
            <button
              type="submit"
              className="btn-block"
              style={{ marginTop: "0.75rem" }}
              disabled={hasValuationError || hasSharesError}
            >
              {submitting ? "Submitting…" : "Issue Property Shares"}
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
