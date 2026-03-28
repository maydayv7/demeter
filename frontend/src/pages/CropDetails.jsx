import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchCropDetails, fetchCropById } from "../api/farmApi";
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
  MapPin,
  Calendar,
  Clock,
  ChevronRight,
  Cpu,
  StickyNote,
  Play,
  Leaf,
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
  calculateMaturity,
  getDaysRemaining,
  getCurrentStage,
  CROP_LIFECYCLES,
  CROP_CYCLE_HOURS,
} from "../utils/dataUtils";
import {
  AgentActionWidget,
  AgentOutcomeWidget,
} from "../components/AgentWidgets";
import {
  PageShell,
  PageHeader,
  IconButton,
  ChartTooltip,
  InlineLabel,
} from "../components/ui";
import { useSettings } from "../hooks/useSettings";
import { useT } from "../hooks/useTranslation";

// Sub-components

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
          <InlineLabel style={{ marginBottom: 0 }}>
            {t("details_ai_reasoning")}
          </InlineLabel>
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
          <InlineLabel style={{ marginBottom: 0 }}>
            {t("details_ai_reasoning")}
          </InlineLabel>
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

function InfoTab({ cropDoc, cropId, navigate, t }) {
  if (!cropDoc) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontFamily: "DM Mono, monospace",
            color: "var(--text-3)",
          }}
        >
          No metadata available yet - run the first cycle to populate data.
        </span>
      </div>
    );
  }

  const maturity = calculateMaturity(cropDoc);
  const daysLeft = getDaysRemaining(cropDoc);
  const stage = getCurrentStage(cropDoc) || cropDoc.stage || "seedling";
  const cycleH =
    cropDoc.cycle_duration_hours ||
    CROP_CYCLE_HOURS[(cropDoc.crop || "").toLowerCase()] ||
    1;
  const lifecycle = CROP_LIFECYCLES[(cropDoc.crop || "").toLowerCase()];

  const plantedDate = cropDoc.planted_at
    ? new Date(cropDoc.planted_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";
  const daysSince = cropDoc.planted_at
    ? Math.floor(
        (Date.now() - new Date(cropDoc.planted_at).getTime()) / 86400000,
      )
    : null;

  const sensorIds = cropDoc.sensor_ids || {};
  const SENSORS_DISPLAY = [
    {
      label: "pH Sensor",
      id: sensorIds.ph_sensor || "PH-SEN-????",
      color: "var(--green)",
    },
    {
      label: "EC Sensor",
      id: sensorIds.ec_sensor || "EC-SEN-????",
      color: "var(--amber)",
    },
    {
      label: "Temp Sensor",
      id: sensorIds.temp_sensor || "TMP-SEN-????",
      color: "var(--blue)",
    },
    {
      label: "Humidity Sensor",
      id: sensorIds.humidity_sensor || "HUM-SEN-????",
      color: "#a78bfa",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Crop header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 20,
          borderRadius: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "rgba(74,222,128,0.1)",
            border: "1px solid rgba(74,222,128,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Leaf size={28} style={{ color: "var(--green)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            {cropDoc.crop}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
            }}
          >
            {cropId}
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                padding: "2px 10px",
                borderRadius: 20,
                background: "rgba(74,222,128,0.12)",
                border: "1px solid rgba(74,222,128,0.3)",
                color: "var(--green)",
                textTransform: "capitalize",
              }}
            >
              {stage}
            </span>
            {cycleH && (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                }}
              >
                {t("details_hours_per_cycle", { n: cycleH })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          {
            icon: Calendar,
            label: t("details_planted"),
            value: plantedDate,
            color: "var(--blue)",
          },
          {
            icon: Clock,
            label: t("details_cycle_duration"),
            value: `${cycleH}h / cycle`,
            color: "var(--green)",
          },
          {
            icon: Leaf,
            label: t("details_lifecycle_progress"),
            value: `${maturity}%`,
            color: "var(--amber)",
          },
          {
            icon: MapPin,
            label: t("details_location"),
            value: cropDoc.location || "-",
            color: "var(--text-2)",
          },
        ].map(({ icon, label, value, color }) => (
          <div
            key={label}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginBottom: 8,
              }}
            >
              {React.createElement(icon, { size: 12, style: { color } })}
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                }}
              >
                {label}
              </span>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color,
                fontFamily: "DM Mono, monospace",
              }}
            >
              {value}
            </div>
          </div>
        ))}

        {/* Days since / remaining */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              marginBottom: 8,
            }}
          >
            {t("details_days_since", { n: daysSince ?? "-" })}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-2)",
            }}
          >
            {daysLeft !== null
              ? t("details_days_remain", { n: daysLeft })
              : "-"}
          </div>
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              marginBottom: 8,
            }}
          >
            {t("details_total_sequences")}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "DM Mono, monospace",
              color: "var(--text)",
            }}
          >
            {cropDoc.sequence_number || 0}
          </div>
        </div>
      </div>

      {/* Lifecycle progress bar */}
      {lifecycle && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              marginBottom: 10,
            }}
          >
            {t("details_lifecycle_progress")} - {lifecycle.totalDays} days total
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: "var(--border)",
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${maturity}%`,
                height: "100%",
                borderRadius: 4,
                background: maturity >= 80 ? "var(--amber)" : "var(--green)",
                transition: "width 0.4s",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {lifecycle.stages.map((s, i) => {
              const colors = [
                "var(--text-3)",
                "var(--green)",
                "var(--amber)",
                "var(--red)",
              ];
              return (
                <div
                  key={s.name}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: colors[i % colors.length],
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "DM Mono, monospace",
                      color: "var(--text-3)",
                      textTransform: "capitalize",
                    }}
                  >
                    {s.name} (
                    {s.endH
                      ? `${Math.round((s.endH - s.startH) / 24)}d`
                      : "harvest"}
                    )
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sensor Hardware */}
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-3)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Cpu size={13} style={{ color: "var(--text-3)" }} />
          <span
            style={{
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              letterSpacing: "0.08em",
            }}
          >
            {t("details_sensor_hardware")}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: "var(--border)",
          }}
        >
          {SENSORS_DISPLAY.map(({ label, id, color }) => (
            <div
              key={label}
              style={{ padding: "14px 16px", background: "var(--surface)" }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                  marginBottom: 6,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: "DM Mono, monospace",
                  fontWeight: 700,
                  color,
                  marginBottom: 4,
                }}
              >
                {id}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--green)",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--green)",
                  }}
                >
                  {t("details_sensor_online")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {cropDoc.notes && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <StickyNote size={13} style={{ color: "var(--text-3)" }} />
            <span
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
              }}
            >
              {t("details_notes")}
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.7,
              margin: 0,
              fontFamily: "DM Mono, monospace",
            }}
          >
            {cropDoc.notes}
          </p>
        </div>
      )}

      {/* Run Cycle CTA */}
      <button
        onClick={() => navigate(`/run-cycle/${cropId}`)}
        style={{
          padding: "14px 20px",
          borderRadius: 12,
          background: "var(--green)",
          border: "none",
          color: "var(--btn-on-green)",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Play size={15} />
        {t("details_run_cycle_btn")}
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// Tabs

const TABS = [
  "details_tab_info",
  "details_tab_overview",
  "details_tab_sensors",
  "details_tab_log",
];

// MAIN

export default function CropDetails() {
  const { cropId } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { t, td } = useT();
  const logLimit = settings.historyLogLimit ?? 20;

  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [cropDoc, setCropDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastExplainedLog, setLastExplainedLog] = useState(null);
  const [activeTab, setActiveTab] = useState("details_tab_info");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      // Qdrant history
      fetchCropDetails(cropId),
      // MongoDB doc
      fetchCropById(cropId),
    ]).then(([histData, mongoDoc]) => {
      if (cancelled) return;

      if (histData?.length) {
        const sorted = [...histData].sort(
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
        const lastExplained = [...processed]
          .reverse()
          .find(
            (h) =>
              h.payload?.explanation_log &&
              h.payload.explanation_log !== "PENDING_ANALYSIS" &&
              h.payload.explanation_log.trim().length > 0,
          );
        setLastExplainedLog(lastExplained?.payload?.explanation_log || null);
      }

      if (mongoDoc) setCropDoc(mongoDoc);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cropId]);

  if (loading)
    return (
      <PageShell>
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
      </PageShell>
    );

  if (!latest && !cropDoc)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "var(--text-3)" }}>{t("details_not_found")}</span>
      </div>
    );

  const p = latest?.payload || {};
  const sensors = latest?.cleanSensors || {};

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

  const displayCrop = cropDoc?.crop || p.crop || t("common_unknown");
  const displayStage = cropDoc?.stage || p.stage || "";

  return (
    <PageShell>
      {/* Header */}
      <PageHeader>
        <IconButton onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={15} />
        </IconButton>

        <div>
          <h1 className="page-title">
            {td(displayCrop)}{" "}
            <span
              style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 16 }}
            >
              #{p.sequence_number || 0}
            </span>
          </h1>
          <p className="page-subtitle">
            {cropId} · {td(displayStage)}
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
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
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
      </PageHeader>

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
        {/* Info Tab */}
        {activeTab === "details_tab_info" && (
          <InfoTab
            cropDoc={cropDoc}
            cropId={cropId}
            navigate={navigate}
            t={t}
          />
        )}

        {/* Overview Tab */}
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
            <ExplanationLogBlock log={lastExplainedLog} t={t} td={td} />
            <div
              style={{
                borderRadius: 14,
                padding: 20,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <InlineLabel>{t("details_hist_ph")}</InlineLabel>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="phGradCD" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
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
                  <Tooltip content={<ChartTooltip />} />
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
                <InlineLabel style={{ marginBottom: 16 }}>
                  {t("details_latest_cmd")}
                </InlineLabel>
                <AgentActionWidget
                  actionTaken={p.action_taken}
                  compact={false}
                />
              </div>
            )}
          </>
        )}

        {/* Sensors Tab */}
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
              <InlineLabel>{t("details_temp_hum")}</InlineLabel>
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
                  <Tooltip content={<ChartTooltip />} />
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
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
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
                  <Tooltip content={<ChartTooltip />} />
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

        {/* Log Tab */}
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
                .map((h, i) => (
                  <LogRow
                    key={i}
                    h={h}
                    i={i}
                    logLimit={logLimit}
                    t={t}
                    td={td}
                    formatNumber={formatNumber}
                    logDotColor={logDotColor}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function LogRow({ h, i, logLimit, t, td, formatNumber, logDotColor }) {
  const [expanded, setExpanded] = useState(false);
  const hasExplanation =
    h.payload?.explanation_log &&
    h.payload.explanation_log !== "PENDING_ANALYSIS";

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        transition: "background 0.12s",
        cursor: "default",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(74,222,128,0.04)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
            ? new Date(h.payload.timestamp).toLocaleTimeString([], {
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
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "pH", value: h.cleanSensors?.ph, color: "var(--green)" },
            { label: "EC", value: h.cleanSensors?.ec, color: "var(--amber)" },
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
              <span style={{ color: "var(--text-3)", fontSize: 11 }}>
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
            onClick={() => setExpanded((v) => !v)}
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
              background: expanded ? "rgba(167,139,250,0.12)" : "var(--bg-3)",
              border: `1px solid ${expanded ? "rgba(167,139,250,0.3)" : "var(--border)"}`,
              color: expanded ? "#a78bfa" : "var(--text-3)",
            }}
          >
            <Brain size={9} /> {expanded ? t("details_hide") : t("details_why")}
          </button>
        )}
      </div>

      {/* Action row */}
      {h.payload?.action_taken &&
        h.payload.action_taken !== "PENDING_ACTION" && (
          <div style={{ padding: "0 20px 10px 46px" }}>
            <AgentActionWidget actionTaken={h.payload.action_taken} compact />
          </div>
        )}

      {/* Explanation log inline */}
      {hasExplanation && expanded && (
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
            <Brain size={9} style={{ display: "inline", marginRight: 5 }} />
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
}
