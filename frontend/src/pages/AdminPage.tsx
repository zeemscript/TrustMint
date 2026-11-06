import { useState, useEffect } from "react";
import { Contract, scValToNative, TransactionBuilder, Account, xdr } from "@stellar/stellar-sdk";
import { useWallet } from "../lib/wallet";
import { contracts } from "../lib/contracts";
import { server, CONTRACT_IDS, NETWORK_PASSPHRASE, fetchContractEvents } from "../lib/stellar";
import { PageHeader, Card, Field, Icon, Skeleton } from "../components/ui";
import WalletGuard from "../components/WalletGuard";
import { useToast } from "../lib/toast";
import type { ComplianceRules, ContractEvent } from "../types";

interface RulesFormState {
  max_transfer_amount: string;
  min_holding_period: string;
  max_holders: string;
  require_same_jurisdiction: boolean;
  paused: boolean;
}

const DEFAULT_RULES: RulesFormState = {
  max_transfer_amount: "0",
  min_holding_period: "0",
  max_holders: "0",
  require_same_jurisdiction: false,
  paused: false,
};

export default function AdminPage() {
  const { address, signTx } = useWallet();
  const { addToast } = useToast();

  const [rules, setRules] = useState<RulesFormState>(DEFAULT_RULES);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!CONTRACT_IDS.complianceEngine) return;

    let cancelled = false;

    async function fetchRules() {
      setLoading(true);
      setFetchError(null);
      try {
        const contract = new Contract(CONTRACT_IDS.complianceEngine);
        const dummyAccount = new Account(
          "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
          "0"
        );
        const tx = new TransactionBuilder(dummyAccount, {
          fee: "100",
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(contract.call("get_rules"))
          .setTimeout(30)
          .build();

        const simResult = await server.simulateTransaction(tx);
        if ("error" in simResult && simResult.error) {
          throw new Error(`Simulation error: ${simResult.error}`);
        }
        const returnVal = (simResult as { result?: { retval: xdr.ScVal } }).result?.retval;
        if (!returnVal) throw new Error("No return value from get_rules simulation");
        const decoded = scValToNative(returnVal) as ComplianceRules;
        if (!cancelled) {
          setRules({
            max_transfer_amount: String(decoded.max_transfer_amount ?? 0),
            min_holding_period: String(decoded.min_holding_period ?? 0),
            max_holders: String(decoded.max_holders ?? 0),
            require_same_jurisdiction: Boolean(decoded.require_same_jurisdiction),
            paused: Boolean(decoded.paused),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Failed to fetch compliance rules.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRules();

    setEventsLoading(true);
    fetchContractEvents(CONTRACT_IDS.complianceEngine, 10)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setEventsLoading(false));

    return () => { cancelled = true; };
  }, []);

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    try {
      await contracts.compliance.setRules(address, {
        max_transfer_amount: BigInt(rules.max_transfer_amount || 0),
        min_holding_period: Number(rules.min_holding_period || 0),
        max_holders: Number(rules.max_holders || 0),
        require_same_jurisdiction: rules.require_same_jurisdiction,
        paused: rules.paused,
      }, signTx);
      addToast("Compliance rules saved successfully.", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to save rules", "error");
    }
  };

  const handlePause = async () => {
    if (!address) return;
    try { await contracts.compliance.pause(address, signTx); addToast("All transfers paused.", "info"); }
    catch (err) { addToast(err instanceof Error ? err.message : "Failed to pause transfers", "error"); }
  };
  const handleUnpause = async () => {
    if (!address) return;
    try { await contracts.compliance.unpause(address, signTx); addToast("Transfers unpaused.", "success"); }
    catch (err) { addToast(err instanceof Error ? err.message : "Failed to unpause transfers", "error"); }
  };

  return (
    <div className="form-narrow">
      <PageHeader
        eyebrow="Governance"
        icon={<Icon.admin size={22} />}
        title="Admin Panel"
        description="Configure global compliance rules. Only the contract admin can call these functions."
      />

      {fetchError && (
        <div style={styles.errorBanner} role="alert">
          <strong>Failed to load current rules:</strong> {fetchError}
        </div>
      )}

      <Card title="Compliance Rules">
        {loading ? (
          <div style={styles.spinnerWrap} aria-label="Loading compliance rules">
            <span style={styles.spinner} aria-hidden="true" />
            <span className="muted" style={{ fontSize: "0.9rem" }}>Loading current rules from chain…</span>
          </div>
        ) : (
          <form onSubmit={handleSaveRules}>
            <Field
              label="Max Transfer Amount (0 = unlimited, in stroops)"
              type="number"
              value={rules.max_transfer_amount}
              onChange={(e) => setRules((r) => ({ ...r, max_transfer_amount: e.target.value }))}
            />
            <Field
              label="Min Holding Period (seconds, 0 = none)"
              type="number"
              value={rules.min_holding_period}
              onChange={(e) => setRules((r) => ({ ...r, min_holding_period: e.target.value }))}
            />
            <Field
              label="Max Holders (0 = unlimited)"
              type="number"
              value={rules.max_holders}
              onChange={(e) => setRules((r) => ({ ...r, max_holders: e.target.value }))}
            />
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={rules.require_same_jurisdiction}
                onChange={(e) => setRules((r) => ({ ...r, require_same_jurisdiction: e.target.checked }))}
              />
              <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>
                Require same jurisdiction for transfers
              </span>
            </label>
            <WalletGuard>
              <button type="submit" className="btn-block">Save Rules</button>
            </WalletGuard>
          </form>
        )}
      </Card>

      <WalletGuard>
        <Card
          title="Emergency Controls"
          subtitle="Pause halts every transfer across all asset tokens"
          style={{ marginTop: "1.25rem" }}
        >
          <div style={{ display: "flex", gap: "1rem" }}>
            <button onClick={handlePause} className="btn-danger" style={{ flex: 1 }}>
              <Icon.bolt size={15} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
              Pause All Transfers
            </button>
            <button onClick={handleUnpause} className="btn-success" style={{ flex: 1 }}>
              Unpause Transfers
            </button>
          </div>
        </Card>
      </WalletGuard>

      <RecentTransactions events={events} loading={eventsLoading} />
    </div>
  );
}

function RecentTransactions({ events, loading }: { events: ContractEvent[]; loading: boolean }) {
  return (
    <Card title="Recent Transactions" style={{ marginTop: "1.25rem" }}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", gap: "1rem", padding: "0.75rem 0" }}>
              <Skeleton width="80px" height="1.25rem" />
              <Skeleton width="100px" height="1.25rem" />
              <Skeleton width="150px" height="1.25rem" />
              <Skeleton width="120px" height="1.25rem" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.875rem" }}>No recent events found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={th}>Type</th><th style={th}>Amount</th><th style={th}>Counterparty</th><th style={th}>Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}>{ev.type}</td>
                <td style={td}>{ev.amount}</td>
                <td style={{ ...td, fontFamily: "monospace", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.counterparty}</td>
                <td style={td}>{ev.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

const th: React.CSSProperties = { padding: "0.4rem 0.5rem", fontWeight: 600, color: "var(--muted)" };
const td: React.CSSProperties = { padding: "0.4rem 0.5rem" };

const SPINNER_KEYFRAMES = `@keyframes vt-spin { to { transform: rotate(360deg); } }`;
if (typeof document !== "undefined") {
  const id = "vt-spinner-style";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = SPINNER_KEYFRAMES;
    document.head.appendChild(style);
  }
}

const styles: Record<string, React.CSSProperties> = {
  checkboxRow: { display: "flex", alignItems: "center", gap: "0.6rem", margin: "0.25rem 0 1.1rem", cursor: "pointer" },
  spinnerWrap: { display: "flex", alignItems: "center", gap: "0.75rem", padding: "1.5rem 0" },
  spinner: { display: "inline-block", width: 20, height: 20, borderRadius: "50%", border: "2.5px solid var(--border)", borderTopColor: "var(--accent-2)", animation: "vt-spin 0.7s linear infinite", flexShrink: 0 },
  errorBanner: { marginBottom: "1.25rem", padding: "0.85rem 1rem", borderRadius: 10, background: "color-mix(in srgb, #ef4444 12%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 35%, transparent)", color: "#ef4444", fontSize: "0.875rem", lineHeight: 1.5 },
};
