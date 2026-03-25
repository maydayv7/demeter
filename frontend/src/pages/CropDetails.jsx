import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchCropDetails } from "../api/farmApi";
import {
  ArrowLeft,
  Thermometer,
  Droplet,
  Wind,
  Activity,
  Brain,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  extractSensors,
  parsePythonString,
  formatNumber,
} from "../utils/dataUtils";
import {
  AgentActionWidget,
  AgentOutcomeWidget,
} from "../components/AgentWidgets";
import Sidebar from "../components/Sidebar";
import { useSettings } from "../hooks/useSettings";
import { useT } from "../hooks/useTranslation";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontFamily: "DM Mono, monospace",
        background: "var(--tooltip-bg)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ color: "var(--text-3)", marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, marginTop: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

function StatBox({ icon: Icon, label, value, color, unit }) {
  return (
    <div
      className="card-hover"
      style={{
        borderRadius: 14,
        padding: "18px 20px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span className="sensor-label">{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="sensor-value" style={{ color }}>
          {value}
        </span>
        {unit && <span className="sensor-unit">{unit}</span>}
      </div>
    </div>
  );
}

// Severity dot for logs
function logDotColor(payload) {
  const outcome = (payload?.outcome || "").toLowerCase();
  if (/fail|critical|disease|error/.test(outcome)) return "var(--red)";
  if (/deteriorat|negative|attention/.test(outcome)) return "var(--amber)";
  return "var(--green)";
}

function ExplanationLogBlock({ log, t, td }) {
  const [expanded, setExpanded] = useState(false);

  const isPending =
    !log || log === "PENDING_ANALYSIS" || log.trim().length === 0;

  if (isPending) {
    return (
      <div
        style={{
          borderRadius: 14,
          padding: "18px 20px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(167,139,250,0.08)",
              border: "1px solid rgba(167,139,250,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Brain size={14} style={{ color: "#a78bfa" }} />
          </div>
          <div className="section-label" style={{ marginBottom: 0 }}>
            {t("details_ai_reasoning")}
          </div>
          <span
            style={{
              fontSize: 9,
              fontFamily: "DM Mono, monospace",
              padding: "2px 8px",
              borderRadius: 20,
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
              color: "var(--text-3)",
            }}
          >
            PENDING
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            fontFamily: "DM Mono, monospace",
            color: "var(--text-3)",
            fontStyle: "italic",
          }}
        >
          {t("details_pending_exp")}
        </div>
      </div>
    );
  }

  const translatedLog = td(log);
  const lines = translatedLog.split("\n").filter((l) => l.trim());
  const isStructured = lines.some((l) => /^\d+\./.test(l.trim()));

  // Preview: first 3 lines
  const previewLines = lines.slice(0, 3);
  const hasMore = lines.length > 3;

  return (
    <div
      style={{
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid rgba(167,139,250,0.2)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(167,139,250,0.05)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "rgba(167,139,250,0.12)",
            border: "1px solid rgba(167,139,250,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Sparkles size={12} style={{ color: "#a78bfa" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            {t("details_ai_reasoning")}
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              marginTop: 2,
            }}
          >
            {t("details_chain_thought")}
          </div>
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 7,
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              cursor: "pointer",
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
              color: "var(--text-3)",
            }}
          >
            {expanded ? (
              <>
                <ChevronUp size={11} /> {t("details_collapse")}
              </>
            ) : (
              <>
                <ChevronDown size={11} /> {t("details_expand")}
              </>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "16px 20px" }}>
        {isStructured ? (
          // Render numbered steps as styled blocks
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(expanded ? lines : previewLines).map((line, i) => {
              const stepMatch = line
                .trim()
                .match(/^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)/);

              if (stepMatch) {
                const [, num, title, body] = stepMatch;
                const stepColors = [
                  "var(--blue)",
                  "#a78bfa",
                  "var(--amber)",
                  "var(--green)",
                ];
                const col = stepColors[(parseInt(num) - 1) % stepColors.length];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "var(--bg-3)",
                      border: `1px solid ${col}18`,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: `${col}18`,
                        border: `1px solid ${col}40`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: 10,
                        fontFamily: "DM Mono, monospace",
                        color: col,
                        fontWeight: 700,
                      }}
                    >
                      {num}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: col,
                          fontFamily: "DM Mono, monospace",
                          marginBottom: 3,
                        }}
                      >
                        {title}
                      </div>
                      {body && (
                        <div
                          style={{
                            fontSize: 12,
                            fontFamily: "DM Mono, monospace",
                            color: "var(--text-2)",
                            lineHeight: 1.7,
                          }}
                        >
                          {body}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Regular line
              return (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--text-2)",
                    lineHeight: 1.7,
                    padding: "2px 0",
                  }}
                >
                  {line}
                </div>
              );
            })}

            {!expanded && hasMore && (
              <button
                onClick={() => setExpanded(true)}
                style={{
                  alignSelf: "flex-start",
                  padding: "5px 12px",
                  borderRadius: 7,
                  fontSize: 11,
                  fontFamily: "DM Mono, monospace",
                  cursor: "pointer",
                  background: "rgba(167,139,250,0.08)",
                  border: "1px solid rgba(167,139,250,0.2)",
                  color: "#a78bfa",
                }}
              >
                {t("details_more_lines", {
                  n: lines.length - previewLines.length,
                })}
              </button>
            )}
          </div>
        ) : (
          // Plain text fallback
          <pre
            style={{
              fontSize: 12,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-2)",
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
              margin: 0,
              maxHeight: expanded ? "none" : 140,
              overflow: expanded ? "visible" : "hidden",
            }}
          >
            {translatedLog}
          </pre>
        )}
      </div>
    </div>
  );
}

const TABS = ["details_tab_overview", "details_tab_sensors", "details_tab_log"];

export default function CropDetails() {
  const { cropId } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { t, td } = useT();
  const logLimit = settings.historyLogLimit ?? 20;

  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details_tab_overview");
  const [showExp, setShowExp] = useState(false);

  useEffect(() => {
    fetchCropDetails(cropId).then((data) => {
      if (data?.length) {
        const sorted = [...data].sort(
          (a, b) =>
            (a.payload?.sequence_number || 0) -
            (b.payload?.sequence_number || 0),
        );
        const processed = sorted.map((item) => ({
          ...item,
          cleanSensors: extractSensors(item.payload || {}),
          parsedAction: parsePythonString((item.payload || {}).action_taken),
        }));
        setHistory(processed);
        setLatest(processed[processed.length - 1]);
      }
      setLoading(false);
    });
  }, [cropId]);

  if (loading)
    return (
      <div
        style={{ display: "flex", height: "100vh", background: "var(--bg)" }}
      >
        <Sidebar />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
            }}
          >
            {t("common_loading")}
          </span>
        </div>
      </div>
    );

  if (!latest)
    return (
      <div
        style={{ display: "flex", height: "100vh", background: "var(--bg)" }}
      >
        <Sidebar />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "var(--text-3)" }}>
            {t("details_not_found")}
          </span>
        </div>
      </div>
    );

  const p = latest.payload || {};
  const sensors = latest.cleanSensors || {};

  const chartData = history.map((h) => ({
    t: h.payload?.timestamp
      ? new Date(h.payload.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--",
    temp: formatNumber(h.cleanSensors?.temp),
    ph: formatNumber(h.cleanSensors?.ph),
    ec: formatNumber(h.cleanSensors?.ec),
    humidity: formatNumber(h.cleanSensors?.humidity),
  }));

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      <Sidebar />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            flexShrink: 0,
            padding: "0 24px",
            height: 64,
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={15} />
          </button>

          <div>
            <h1 className="page-title">
              {td(p.crop) || t("common_unknown")}{" "}
              <span
                style={{
                  color: "var(--text-3)",
                  fontWeight: 400,
                  fontSize: 16,
                }}
              >
                #{p.sequence_number || 0}
              </span>
            </h1>
            <p className="page-subtitle">
              {cropId} · {td(p.stage)}
            </p>
          </div>

          {/* Live badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 20,
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.25)",
              fontSize: 11,
              fontFamily: "DM Mono, monospace",
              color: "var(--green)",
            }}
          >
            <span
              className="status-dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--green)",
              }}
            />
            {t("details_live")}
          </div>

          {/* Tabs */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  textTransform: "capitalize",
                  cursor: "pointer",
                  background:
                    activeTab === tab ? "var(--surface-2)" : "transparent",
                  color: activeTab === tab ? "var(--text)" : "var(--text-3)",
                  border: `1px solid ${activeTab === tab ? "var(--border-bright)" : "transparent"}`,
                }}
              >
                {t(tab)}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {activeTab === "details_tab_overview" && (
            <>
              {/* Sensor stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 12,
                }}
              >
                <StatBox
                  icon={Thermometer}
                  label={t("sensor_temp")}
                  value={formatNumber(sensors.temp)}
                  unit="°C"
                  color="var(--blue)"
                />
                <StatBox
                  icon={Droplet}
                  label={t("sensor_ph")}
                  value={formatNumber(sensors.ph)}
                  unit=""
                  color="var(--green)"
                />
                <StatBox
                  icon={Activity}
                  label={t("sensor_ec")}
                  value={formatNumber(sensors.ec)}
                  unit="dS/m"
                  color="var(--amber)"
                />
                <StatBox
                  icon={Wind}
                  label={t("sensor_humidity")}
                  value={formatNumber(sensors.humidity)}
                  unit="%"
                  color="#a78bfa"
                />
              </div>

              {/* Outcome */}
              {p.outcome && p.outcome !== "PENDING_OBSERVATION" && (
                <AgentOutcomeWidget
                  outcome={p.outcome}
                  rewardScore={p.reward_score}
                  strategicIntent={p.strategic_intent}
                />
              )}
              <ExplanationLogBlock log={p.explanation_log} t={t} td={td} />
              <div
                style={{
                  borderRadius: 14,
                  padding: 20,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="section-label">{t("details_hist_ph")}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="phGradCD" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#4ade80"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#4ade80"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="t"
                      tick={{
                        fontSize: 10,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{
                        fontSize: 10,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="ph"
                      stroke="var(--green)"
                      fill="url(#phGradCD)"
                      strokeWidth={2}
                      dot={false}
                      name={t("chart_ph")}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Latest Action */}
              {p.action_taken && p.action_taken !== "PENDING_ACTION" && (
                <div
                  style={{
                    borderRadius: 14,
                    padding: 20,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="section-label" style={{ marginBottom: 16 }}>
                    {t("details_latest_cmd")}
                  </div>
                  <AgentActionWidget
                    actionTaken={p.action_taken}
                    compact={false}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === "details_tab_sensors" && (
            <>
              <div
                style={{
                  borderRadius: 14,
                  padding: 20,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="section-label">{t("details_temp_hum")}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="t"
                      tick={{
                        fontSize: 10,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 10,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={false}
                      name={t("chart_temp")}
                    />
                    <Line
                      type="monotone"
                      dataKey="humidity"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={false}
                      name={t("chart_humidity")}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  borderRadius: 14,
                  padding: 20,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="section-label">{t("details_ec_conc")}</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="ecGradCD" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#f59e0b"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="#f59e0b"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="t"
                      tick={{
                        fontSize: 10,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 10,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="ec"
                      stroke="var(--amber)"
                      fill="url(#ecGradCD)"
                      strokeWidth={2}
                      dot={false}
                      name={t("chart_ec")}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {activeTab === "details_tab_log" && (
            <div
              style={{
                borderRadius: 14,
                overflow: "hidden",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              {/* Header row */}
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="section-label">
                  {t("details_event_log", {
                    total: history.length,
                    limit: logLimit,
                  })}
                </div>
              </div>

              {/* Log rows */}
              <div>
                {[...history]
                  .reverse()
                  .slice(0, logLimit)
                  .map((h, i) => {
                    const hasExplanation =
                      h.payload?.explanation_log &&
                      h.payload.explanation_log !== "PENDING_ANALYSIS";
                    return (
                      <div
                        key={i}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          transition: "background 0.12s",
                          cursor: "default",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(74,222,128,0.04)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        {/* Row header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 20px",
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: logDotColor(h.payload),
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "DM Mono, monospace",
                              color: "var(--text-3)",
                              flexShrink: 0,
                              width: 52,
                            }}
                          >
                            {h.payload?.timestamp
                              ? new Date(
                                  h.payload.timestamp,
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "--"}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "DM Mono, monospace",
                              color: "var(--text-3)",
                              width: 36,
                              flexShrink: 0,
                            }}
                          >
                            #{h.payload?.sequence_number || i}
                          </span>

                          {/* Sensor snapshot */}
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            {[
                              {
                                label: "pH",
                                value: h.cleanSensors?.ph,
                                color: "var(--green)",
                              },
                              {
                                label: "EC",
                                value: h.cleanSensors?.ec,
                                color: "var(--amber)",
                              },
                              {
                                label: "T",
                                value: h.cleanSensors?.temp + "°",
                                color: "var(--blue)",
                              },
                              {
                                label: "H",
                                value: h.cleanSensors?.humidity + "%",
                                color: "#a78bfa",
                              },
                            ].map(({ label, value, color }) => (
                              <span
                                key={label}
                                style={{
                                  fontSize: 13,
                                  fontFamily: "DM Mono, monospace",
                                  display: "flex",
                                  alignItems: "baseline",
                                  gap: 3,
                                }}
                              >
                                <span
                                  style={{
                                    color: "var(--text-3)",
                                    fontSize: 11,
                                  }}
                                >
                                  {label}
                                </span>
                                <span style={{ color, fontWeight: 700 }}>
                                  {formatNumber(value)}
                                </span>
                              </span>
                            ))}
                          </div>

                          {/* Outcome badge */}
                          {h.payload?.outcome && (
                            <span style={{ marginLeft: "auto", flexShrink: 0 }}>
                              <AgentOutcomeWidget
                                outcome={h.payload.outcome}
                                rewardScore={h.payload.reward_score}
                              />
                            </span>
                          )}

                          {/* Explanation toggle */}
                          {hasExplanation && (
                            <button
                              onClick={() => setShowExp((v) => !v)}
                              style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 8px",
                                borderRadius: 6,
                                fontSize: 9,
                                fontFamily: "DM Mono, monospace",
                                cursor: "pointer",
                                background: showExp
                                  ? "rgba(167,139,250,0.12)"
                                  : "var(--bg-3)",
                                border: `1px solid ${showExp ? "rgba(167,139,250,0.3)" : "var(--border)"}`,
                                color: showExp ? "#a78bfa" : "var(--text-3)",
                              }}
                            >
                              <Brain size={9} />{" "}
                              {showExp ? t("details_hide") : t("details_why")}
                            </button>
                          )}
                        </div>

                        {/* Action row */}
                        {h.payload?.action_taken &&
                          h.payload.action_taken !== "PENDING_ACTION" && (
                            <div style={{ padding: "0 20px 10px 46px" }}>
                              <AgentActionWidget
                                actionTaken={h.payload.action_taken}
                                compact
                              />
                            </div>
                          )}

                        {/* Explanation log inline */}
                        {hasExplanation && showExp && (
                          <div
                            className="animate-fade-in"
                            style={{
                              margin: "0 20px 12px 46px",
                              padding: "12px 14px",
                              borderRadius: 10,
                              background: "rgba(167,139,250,0.05)",
                              border: "1px solid rgba(167,139,250,0.15)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 9,
                                fontFamily: "DM Mono, monospace",
                                color: "#a78bfa",
                                marginBottom: 8,
                              }}
                            >
                              <Brain
                                size={9}
                                style={{ display: "inline", marginRight: 5 }}
                              />{" "}
                              {t("details_ai_reasoning")}
                            </div>
                            <pre
                              style={{
                                fontSize: 11,
                                fontFamily: "DM Mono, monospace",
                                color: "var(--text-2)",
                                lineHeight: 1.7,
                                whiteSpace: "pre-wrap",
                                margin: 0,
                              }}
                            >
                              {td(h.payload.explanation_log)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
