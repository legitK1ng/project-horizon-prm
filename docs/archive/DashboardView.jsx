import { useState } from "react";

// ─── Design Tokens ──────────────────────────────────────────────────────────
const T = {
  bg:          "#0E0D0B",
  surface:     "rgba(255,255,255,0.04)",
  surfaceMd:   "rgba(255,255,255,0.07)",
  surfaceHover:"rgba(255,255,255,0.09)",
  border:      "rgba(255,255,255,0.08)",
  borderMd:    "rgba(255,255,255,0.13)",
  inkPrimary:  "#E8E4DC",
  inkSecond:   "#9B9289",
  inkMuted:    "#5C5750",
  ochre:       "#E8A656",
  ochreAlpha:  "rgba(232,166,86,0.14)",
  ochreBorder: "rgba(232,166,86,0.32)",
  green:       "#70C98A",
  greenAlpha:  "rgba(112,201,138,0.14)",
  greenBorder: "rgba(112,201,138,0.30)",
  blue:        "#68A5E8",
  blueAlpha:   "rgba(104,165,232,0.14)",
  blueBorder:  "rgba(104,165,232,0.30)",
  purple:      "#B784E8",
  purpleAlpha: "rgba(183,132,232,0.14)",
  purpleBorder:"rgba(183,132,232,0.30)",
  red:         "#E07070",
  redAlpha:    "rgba(224,112,112,0.14)",
  redBorder:   "rgba(224,112,112,0.30)",
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function DashboardView() {
  const [nudges, setNudges] = useState([
    { id: "nudge-1", name: "Marcus Brody", company: "Vanguard", task: "Submit LOI for Austin data center lease option", due: "Today 5:00 PM", urgency: "critical" },
    { id: "nudge-2", name: "Sarah Jenkins", company: "Apex Ventures", task: "Send revised side-letter for board observer seat", due: "Tomorrow 2:00 PM", urgency: "high" },
    { id: "nudge-3", name: "David Chen", company: "DSL", task: "Review mobile SQLite packet staging buffering queue", due: "Nov 2", urgency: "medium" },
  ]);

  const [activeCallFilter, setActiveCallFilter] = useState("all");

  const handleDismissNudge = (id) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div style={{
      background: T.bg,
      minHeight: "100vh",
      padding: "28px 24px",
      fontFamily: "'Geist Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: T.inkPrimary,
      boxSizing: "border-box"
    }}>

      {/* ── Page Header ── */}
      <header style={{ marginBottom: "26px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ fontSize: "16px", color: T.inkMuted }}>◎</span>
              <h1 style={{
                margin: 0,
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: "20px",
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: T.inkPrimary,
              }}>
                Executive Dashboard
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: T.inkMuted, paddingLeft: "26px" }}>
              Relationship intelligence · Live pipeline telemetry · Action radar
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Pill label="HP-Z2G3 Node" value="Online (100.90.84.53)" green />
            <Pill label="Tailscale Funnel" value="Port 9000 Active" accent />
            <Pill label="Whisper Engine" value="Faster-Whisper CUDA" />
          </div>
        </div>
      </header>

      {/* ── Top Metric KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <MetricCard
          label="Call Velocity (7d)"
          value="18 calls"
          delta="+24% vs last week"
          deltaPositive
          subtext="Avg duration: 5m 14s"
        />
        <MetricCard
          label="Action Commitments"
          value={`${nudges.length} pending`}
          delta="1 critical today"
          deltaColor={T.red}
          subtext="Extracted by Gemini Flash"
        />
        <MetricCard
          label="Relationship Warmth"
          value="94.2%"
          delta="1 cooling contact"
          deltaColor={T.ochre}
          subtext="Top cluster: Series A Syndicate"
        />
        <MetricCard
          label="Vault Audio Assets"
          value="128 MB"
          delta="AES-256 Encrypted"
          deltaPositive
          subtext="47 recordings indexed"
        />
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", alignItems: "start" }}>

        {/* ══ COLUMN 1: Operational Radar & Latest Call ═══════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Card: Urgent Action Radar / Nudge Shelf */}
          <Card>
            <CardHeader
              title="Urgent Action Radar"
              badge={`${nudges.length} Commitments`}
              badgeGreen={nudges.length === 0}
              description="High-priority commitments extracted from recent call transcripts"
            />

            {nudges.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: T.green }}>
                ✓ All commitments resolved. You are completely caught up!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {nudges.map((n) => {
                  const isCrit = n.urgency === "critical";
                  return (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        background: isCrit ? "rgba(224,112,112,0.06)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isCrit ? T.redBorder : T.border}`,
                        borderRadius: "8px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontFamily: "'Bricolage Grotesque', sans-serif",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: isCrit ? T.red : T.inkPrimary
                          }}>
                            {n.name}
                          </span>
                          <span style={{ fontSize: "11px", color: T.inkMuted }}>· {n.company}</span>
                        </div>
                        <span style={{ fontSize: "12px", color: T.inkSecond }}>{n.task}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{
                          fontSize: "10px",
                          fontFamily: "'JetBrains Mono', monospace",
                          color: isCrit ? T.red : T.ochre,
                          fontWeight: 600
                        }}>
                          {n.due}
                        </span>
                        <button
                          onClick={() => handleDismissNudge(n.id)}
                          style={{
                            padding: "4px 10px",
                            background: "rgba(255,255,255,0.06)",
                            border: `1px solid ${T.borderMd}`,
                            borderRadius: "5px",
                            color: T.inkPrimary,
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Resolve ✓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Card: Latest Briefing Spotlight */}
          <Card>
            <CardHeader
              title="Latest Call Synthesis"
              badge="Today 2:22 PM"
              description="Most recently ingested call via Tailscale Funnel / Whisper v1"
            />

            <div style={{
              background: "rgba(0,0,0,0.25)",
              border: `1px solid ${T.border}`,
              borderRadius: "8px",
              padding: "16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: T.ochre, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    ↗ Inbound Call · 6m 24s · Sarah Jenkins (Apex Ventures)
                  </div>
                  <h3 style={{
                    margin: "4px 0",
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: T.inkPrimary
                  }}>
                    Q4 Series A Syndication Terms & Legal Sign-off
                  </h3>
                </div>
                <span style={{
                  fontSize: "10px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: T.greenAlpha,
                  border: `1px solid ${T.greenBorder}`,
                  color: T.green,
                  fontWeight: 600
                }}>
                  Sentiment: Positive (88%)
                </span>
              </div>

              <p style={{ fontSize: "12px", lineHeight: "1.7", color: T.inkSecond, margin: "0 0 12px 0" }}>
                Sarah confirmed that Cooley completed their IP audit with no blockers. Apex agreed to lead with a $2.5M commitment provided we lock in the board seat observer rights by Friday afternoon.
              </p>

              {/* Action pill tags */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={styles.miniTag}>#Fundraising</span>
                <span style={styles.miniTag}>#TermSheet</span>
                <span style={styles.miniTag}>#Legal</span>
                <span style={styles.miniTag}>#ObserverSeat</span>
              </div>
            </div>
          </Card>

          {/* Card: 7-Day Ingestion Velocity Graph */}
          <Card>
            <CardHeader
              title="7-Day Call Velocity"
              badge="Daily Volume"
              description="Audio throughput and transcription activity over the past week"
            />

            {/* Simulated Bar Chart */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", height: "100px", padding: "10px 0" }}>
              {[
                { day: "Fri", calls: 2, height: "35%" },
                { day: "Sat", calls: 0, height: "10%" },
                { day: "Sun", calls: 1, height: "20%" },
                { day: "Mon", calls: 4, height: "65%" },
                { day: "Tue", calls: 3, height: "50%" },
                { day: "Wed", calls: 5, height: "85%" },
                { day: "Thu", calls: 3, height: "50%", current: true },
              ].map((d) => (
                <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <div style={{
                    width: "100%",
                    height: d.height,
                    background: d.current ? T.ochre : "rgba(255,255,255,0.12)",
                    borderRadius: "4px",
                    transition: "all 0.2s ease"
                  }} />
                  <span style={{ fontSize: "10px", color: d.current ? T.ochre : T.inkMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          </Card>

        </div>

        {/* ══ COLUMN 2: Sidebar (Relationship Warmth & Bot Guardian) ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Card: Relationship Pulse / Warmth Radar */}
          <Card>
            <CardHeader
              title="Relationship Pulse"
              badge="CRM Sync"
              description="Communication warmth and touchpoint frequency"
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { name: "Sarah Jenkins", role: "Apex Ventures", warmth: 95, status: "Active Lead", statusColor: T.green },
                { name: "David Chen", role: "Distributed Labs", warmth: 84, status: "Collaborator", statusColor: T.blue },
                { name: "Marcus Brody", role: "Vanguard", warmth: 72, status: "Critical Option", statusColor: T.ochre },
                { name: "Elena Rostova", role: "BioSyn Analytics", warmth: 68, status: "Research Sync", statusColor: T.purple },
              ].map((c) => (
                <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                    <div>
                      <span style={{ fontWeight: 600, color: T.inkPrimary }}>{c.name}</span>
                      <span style={{ fontSize: "11px", color: T.inkMuted, marginLeft: "6px" }}>{c.role}</span>
                    </div>
                    <span style={{ fontSize: "10px", color: c.statusColor, fontWeight: 600 }}>{c.status}</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${c.warmth}%`, height: "100%", background: c.statusColor, borderRadius: "2px" }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Card: Sentinel Guardian Telemetry */}
          <Card>
            <CardHeader
              title="Sentinel Guardian"
              badge="Self-Healing"
              badgeGreen
              description="Continuous pipeline integrity supervisor"
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <StatusRow label="Ingestion Daemon" value="Port 9000 UP" ok />
              <StatusRow label="Dashboard API" value="Port 8000 UP" ok />
              <StatusRow label="Database Sync" value="Supabase Realtime" ok />
              <StatusRow label="Ollama Remote" value="kimi-k2:1t-cloud" ok />
              <StatusRow label="Encryption Master" value="Active (AES-GCM)" ok />
            </div>

            <div style={{
              marginTop: "12px",
              padding: "10px",
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${T.border}`,
              borderRadius: "6px",
              fontSize: "11px",
              fontFamily: "'JetBrains Mono', monospace",
              color: T.green
            }}>
              ● Sentinel cycle: 0 anomalies detected in 24h
            </div>
          </Card>

        </div>

      </div>

    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: "12px",
      padding: "18px 20px",
    }}>
      {children}
    </div>
  );
}

function CardHeader({ title, badge, badgeGreen, description }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
        <span style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          color: T.inkPrimary,
          letterSpacing: "-0.01em",
        }}>{title}</span>
        <span style={{
          fontSize: "10px",
          padding: "1px 7px",
          borderRadius: "20px",
          background: badgeGreen ? T.greenAlpha : T.ochreAlpha,
          border: `1px solid ${badgeGreen ? T.greenBorder : T.ochreBorder}`,
          color: badgeGreen ? T.green : T.ochre,
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}>{badge}</span>
      </div>
      <p style={{ margin: 0, fontSize: "11px", color: T.inkMuted }}>{description}</p>
    </div>
  );
}

function MetricCard({ label, value, delta, deltaPositive, deltaColor, subtext }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: "10px",
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "4px"
    }}>
      <span style={{ fontSize: "11px", color: T.inkMuted, fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: "20px",
          fontWeight: 600,
          color: T.inkPrimary
        }}>
          {value}
        </span>
        <span style={{
          fontSize: "10px",
          color: deltaColor || (deltaPositive ? T.green : T.ochre),
          fontWeight: 600
        }}>
          {delta}
        </span>
      </div>
      <span style={{ fontSize: "10px", color: T.inkMuted }}>{subtext}</span>
    </div>
  );
}

function Pill({ label, value, accent, green }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "3px 10px",
      borderRadius: "20px",
      background: green ? T.greenAlpha : accent ? T.ochreAlpha : "rgba(255,255,255,0.04)",
      border: `1px solid ${green ? T.greenBorder : accent ? T.ochreBorder : T.border}`,
    }}>
      <span style={{ fontSize: "10px", color: T.inkMuted }}>{label}</span>
      <span style={{
        fontSize: "10px",
        fontWeight: 600,
        color: green ? T.green : accent ? T.ochre : T.inkSecond,
      }}>{value}</span>
    </div>
  );
}

function StatusRow({ label, value, ok }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
      <span style={{ color: T.inkMuted }}>{label}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        color: ok ? T.green : T.red,
        fontWeight: 600
      }}>
        {value}
      </span>
    </div>
  );
}

const styles = {
  miniTag: {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${T.border}`,
    color: T.inkSecond,
  }
};
