import { useState, useEffect } from "react";
import { useWallet } from "../lib/wallet";
import { contracts } from "../lib/contracts";
import { CONTRACT_IDS, fetchContractEvents } from "../lib/stellar";
import { useAddressValidation } from "../lib/useAddressValidation";
import { PageHeader, Card, Field, Select, Icon } from "../components/ui";
import WalletGuard from "../components/WalletGuard";
import { useToast } from "../lib/toast";
import type { ContractEvent } from "../types";

export default function KycPage() {
  const { address, signTx } = useWallet();
  const { addToast } = useToast();
  const [lookup, setLookup] = useState("");
  const [approveForm, setApproveForm] = useState({
    subject: "",
    tier: "0",
    jurisdiction: "",
    expiry_days: "365",
  });
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [record, setRecord] = useState<import("../types").KycRecord | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  // Validation for both address fields
  const lookupValidation = useAddressValidation(lookup);
  const subjectValidation = useAddressValidation(approveForm.subject);

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setApproveForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!CONTRACT_IDS.kycRegistry) return;
    setEventsLoading(true);
    fetchContractEvents(CONTRACT_IDS.kycRegistry, 10)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupValidation.isValid) {
      addToast("Please enter a valid Stellar address", "error");
      return;
    }
    setLookupLoading(true);
    setRecord(null);
    contracts.kyc.getRecord(lookup)
      .then(setRecord)
      .catch((err: unknown) => addToast(err instanceof Error ? err.message : "No KYC record found", "error"))
      .finally(() => setLookupLoading(false));
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectValidation.isValid) {
      addToast("Please enter a valid Stellar address for the subject", "error");
      return;
    }
    if (!address) return;
    const jurisdiction = approveForm.jurisdiction.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(jurisdiction)) {
      addToast("Jurisdiction must be a two-letter country code", "error");
      return;
    }
    setApproveLoading(true);
    try {
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Number(approveForm.expiry_days || 0) * 86400);
      await contracts.kyc.approve(address, approveForm.subject, Number(approveForm.tier), expiry, jurisdiction, signTx);
      addToast(`KYC approved for ${approveForm.subject}.`, "success");
      setApproveForm({ subject: "", tier: "0", jurisdiction: "", expiry_days: "365" });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "KYC approval failed", "error");
    } finally {
      setApproveLoading(false);
    }
  };

  return (
    <div className="form-narrow">
      <PageHeader
        eyebrow="Compliance"
        icon={<Icon.kyc size={22} />}
        title="KYC Registry"
        description="Manage investor KYC approvals. Only authorized verifiers can approve or revoke status — every token transfer is gated by this registry."
      />

      <Card title="Check KYC Status">
        <form
          onSubmit={handleLookup}
          style={{ display: "flex", gap: "0.75rem" }}
        >
          <div style={{ flex: 1 }}>
            <input
              placeholder="Stellar address (G…)"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderColor:
                  !lookupValidation.isValid && lookup.length > 0
                    ? "#ef4444"
                    : undefined,
              }}
            />
            {lookupValidation.error && lookup.length > 0 && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "0.8rem",
                  marginTop: "0.25rem",
                }}
              >
                {lookupValidation.error}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!lookupValidation.isValid && lookup.length > 0}
          >
            Lookup
          </button>
        </form>
        {lookupLoading && <p className="muted" style={{ marginTop: "0.75rem" }}>Reading from the registry…</p>}
        {record && (
          <div className="card" style={{ marginTop: "0.75rem", background: "var(--surface-2)" }}>
            <strong>{record.status}</strong> · Tier {record.tier} · {record.jurisdiction || "No jurisdiction"}
            {record.expiry ? ` · Expires ${new Date(Number(record.expiry) * 1000).toLocaleDateString()}` : " · No expiry"}
          </div>
        )}
      </Card>

      <WalletGuard>
        <Card
          title="Approve KYC"
          subtitle="Verifier only"
          style={{ marginTop: "1.25rem" }}
        >
          <form onSubmit={handleApprove}>
            <Field
              label="Subject Address"
              value={approveForm.subject}
              onChange={set("subject")}
              required
              placeholder="G…"
              error={subjectValidation.error}
            />
            <Select
              label="KYC Tier"
              value={approveForm.tier}
              onChange={set("tier")}
              options={[
                { value: "0", label: "0 — Basic" },
                { value: "1", label: "1 — Accredited Investor" },
                { value: "2", label: "2 — Institutional" },
              ]}
            />
            <Field
              label="Jurisdiction"
              value={approveForm.jurisdiction}
              onChange={set("jurisdiction")}
              required
              placeholder="US, EU, NG …"
            />
            <Field
              label="Validity (days)"
              type="number"
              value={approveForm.expiry_days}
              onChange={set("expiry_days")}
            />
            <button
              type="submit"
              className="btn-success btn-block"
              style={{ marginTop: "0.5rem" }}
              disabled={!subjectValidation.isValid}
            >
              {approveLoading ? "Submitting…" : "Approve KYC"}
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
