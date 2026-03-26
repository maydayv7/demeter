import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useT } from "../hooks/useTranslation";
import {
  Activity,
  Mic,
  Square,
  Brain,
  Search,
  Sparkles,
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  Droplets,
  Thermometer,
  Wind,
  BookOpen,
  MessageSquare,
  ChevronDown,
  Leaf,
  X,
  GitBranch,
  ExternalLink,
} from "lucide-react";
import { agentService } from "../api/agentApi";
import { extractSensors, deriveCropStatus } from "../utils/dataUtils";
import {
  AgentActionWidget,
  AgentOutcomeWidget,
} from "../components/AgentWidgets";
import Sidebar from "../components/Sidebar";
import { useFarmData } from "../hooks/useFarmData";

// Suggestion banks
const getGlobalSuggestions = (t) => [
  t("sug_g1"),
  t("sug_g2"),
  t("sug_g3"),
  t("sug_g4"),
  t("sug_g5"),
  t("sug_g6"),
];
const getCropSuggestions = (crop, t) => [
  t("sug_c1", { crop }),
  t("sug_c2", { crop }),
  t("sug_c3", { crop }),
  t("sug_c4", { crop }),
  t("sug_c5", { crop }),
  t("sug_c6", { crop }),
];

// Thinking block renderer
function ThinkingBlock({ text, t }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid rgba(167,139,250,0.2)",
        background: "rgba(167,139,250,0.04)",
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Brain size={11} style={{ color: "#a78bfa", flexShrink: 0 }} />
        <span
          style={{
            fontSize: 10,
            fontFamily: "DM Mono, monospace",
            color: "#a78bfa",
            flex: 1,
          }}
        >
          {t("intel_thinking")} {open ? "▲" : "▼"}
        </span>
        <span
          style={{
            fontSize: 9,
            fontFamily: "DM Mono, monospace",
            color: "var(--text-3)",
          }}
        >
          {t("intel_steps", { n: text.split("\n").filter(Boolean).length })}
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "0 14px 12px",
            borderTop: "1px solid rgba(167,139,250,0.15)",
          }}
        >
          <pre
            style={{
              fontSize: 11,
              fontFamily: "DM Mono, monospace",
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
              color: "var(--text-3)",
              margin: "10px 0 0",
            }}
          >
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

// LLM Answer block
function LLMAnswerBlock({
  answer,
  thinking,
  cropContext,
  referencedCrops,
  t,
  td,
}) {
  if (!answer) return null;

  return (
    <div
      className="animate-fade-in"
      style={{
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid rgba(167,139,250,0.25)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 18px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(167,139,250,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: "rgba(167,139,250,0.15)",
            border: "1px solid rgba(167,139,250,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Sparkles size={12} style={{ color: "#a78bfa" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "DM Mono, monospace",
              color: "#a78bfa",
              fontWeight: 600,
            }}
          >
            {t("intel_demeter")}
          </div>
          {cropContext && (
            <div
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
                marginTop: 1,
              }}
            >
              {t("intel_context")}: {td(cropContext.crop)} ·{" "}
              {cropContext.cropId}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: 9,
            fontFamily: "DM Mono, monospace",
            color: "var(--text-3)",
            padding: "2px 8px",
            borderRadius: 20,
            background: "var(--bg-3)",
            border: "1px solid var(--border)",
          }}
        >
          {cropContext ? t("intel_crop_aware") : t("intel_fleet_wide")}
        </div>
      </div>

      <div style={{ padding: 18 }}>
        <ThinkingBlock text={thinking} t={t} />
        <div
          style={{
            fontSize: 13,
            fontFamily: "DM Mono, monospace",
            color: "var(--text-2)",
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
          }}
        >
          {answer}
        </div>

        {/* Referenced crops inline mention */}
        {referencedCrops && referencedCrops.length > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(167,139,250,0.06)",
              border: "1px solid rgba(167,139,250,0.15)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
              }}
            >
              <ExternalLink
                size={9}
                style={{ display: "inline", marginRight: 4 }}
              />
              {t("intel_data_from")}:
            </span>
            {referencedCrops.map((c, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "rgba(167,139,250,0.12)",
                  color: "#a78bfa",
                  border: "1px solid rgba(167,139,250,0.25)",
                }}
              >
                {td(c.crop)} · {c.cropId}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Related crops card
function RelatedCropCard({ item, score, t, td }) {
  const p = item.payload || {};
  const s = extractSensors(p);
  const status = deriveCropStatus(p);

  const statusColor =
    status === "Healthy"
      ? "var(--green)"
      : status === "Attention"
        ? "var(--amber)"
        : "var(--red)";

  const scoreColor =
    score > 0.8
      ? "var(--green)"
      : score > 0.6
        ? "var(--amber)"
        : "var(--text-3)";

  return (
    <div
      style={{
        borderRadius: 12,
        padding: "14px 16px",
        background: "var(--bg-3)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
            {td(p.crop) || t("common_unknown")}
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              marginTop: 2,
            }}
          >
            {p.crop_id || "—"} · Seq #{p.sequence_number || 1}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontFamily: "DM Mono, monospace",
              padding: "2px 7px",
              borderRadius: 20,
              color: statusColor,
              background: `${statusColor}18`,
              border: `1px solid ${statusColor}30`,
            }}
          >
            {td(status.toUpperCase())}
          </span>
          {score !== undefined && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                color: scoreColor,
              }}
            >
              {t("intel_match", { n: (score * 100).toFixed(0) })}
            </span>
          )}
        </div>
      </div>

      {/* Mini sensor row */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { label: "pH", value: s.ph, color: "var(--green)" },
          { label: "EC", value: s.ec, color: "var(--amber)" },
          { label: "T", value: `${s.temp}°`, color: "var(--blue)" },
          { label: "H", value: `${s.humidity}%`, color: "#a78bfa" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "5px 4px",
              borderRadius: 6,
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "var(--text-3)",
                fontFamily: "DM Mono, monospace",
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color,
                fontFamily: "DM Mono, monospace",
                marginTop: 1,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Outcome */}
      {p.outcome && p.outcome !== "PENDING_OBSERVATION" && (
        <AgentOutcomeWidget outcome={p.outcome} rewardScore={p.reward_score} />
      )}
    </div>
  );
}

// Main insight card (search results)
function InsightCard({ result, idx, t, td }) {
  const p = result.payload || {};
  const s = extractSensors(p);
  const status = deriveCropStatus(p);

  const statusColors = {
    Healthy: {
      color: "var(--green)",
      bg: "rgba(74,222,128,0.1)",
      border: "rgba(74,222,128,0.25)",
    },
    Attention: {
      color: "var(--amber)",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.25)",
    },
    Critical: {
      color: "var(--red)",
      bg: "rgba(248,113,113,0.1)",
      border: "rgba(248,113,113,0.25)",
    },
  };
  const sc = statusColors[status] || statusColors.Healthy;

  return (
    <div
      className="card-hover animate-fade-up"
      style={{
        borderRadius: 14,
        padding: 18,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        animationDelay: `${idx * 60}ms`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
            {td(p.crop) || t("common_unknown")}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
              marginTop: 2,
            }}
          >
            {p.crop_id || "—"} · Seq #{p.sequence_number || 1}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontFamily: "DM Mono, monospace",
              padding: "3px 8px",
              borderRadius: 20,
              background: sc.bg,
              color: sc.color,
              border: `1px solid ${sc.border}`,
            }}
          >
            {td(status.toUpperCase())}
          </span>
          {p.stage && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                padding: "2px 7px",
                borderRadius: 4,
                background: "var(--bg-3)",
                color: "var(--text-3)",
                border: "1px solid var(--border)",
              }}
            >
              {td(p.stage)}
            </span>
          )}
          {result.score !== undefined && result.score < 1 && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                color:
                  result.score > 0.8
                    ? "var(--green)"
                    : result.score > 0.6
                      ? "var(--amber)"
                      : "var(--text-3)",
              }}
            >
              {t("intel_match", { n: (result.score * 100).toFixed(0) })}
            </span>
          )}
        </div>
      </div>

      {/* Sensors */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          { icon: Droplets, label: "pH", value: s.ph, color: "var(--green)" },
          { icon: Activity, label: "EC", value: s.ec, color: "var(--amber)" },
          {
            icon: Thermometer,
            label: "Temp",
            value: s.temp + "°",
            color: "var(--blue)",
          },
          {
            icon: Wind,
            label: "Humidity",
            value: s.humidity + "%",
            color: "#a78bfa",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            style={{
              borderRadius: 8,
              padding: "7px 8px",
              textAlign: "center",
              background: "var(--bg-3)",
            }}
          >
            <Icon
              size={10}
              style={{ color, margin: "0 auto 3px", display: "block" }}
            />
            <div className="sensor-label" style={{ marginBottom: 2 }}>
              {label}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "DM Mono, monospace",
                color,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Outcome */}
      {p.outcome && p.outcome !== "PENDING_OBSERVATION" && (
        <AgentOutcomeWidget
          outcome={p.outcome}
          rewardScore={p.reward_score}
          strategicIntent={p.strategic_intent}
        />
      )}

      {/* Last action */}
      {p.action_taken && p.action_taken !== "PENDING_ACTION" && (
        <div style={{ marginTop: 12 }}>
          <div
            className="section-label"
            style={{ fontSize: 9, marginBottom: 8 }}
          >
            {t("intel_last_cmd")}
          </div>
          <AgentActionWidget actionTaken={p.action_taken} compact />
        </div>
      )}
    </div>
  );
}

// Fleet stat pill
function FleetStat({ label, value, color, icon: Icon }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 18px",
        borderRadius: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        flex: 1,
        minWidth: 120,
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
          flexShrink: 0,
        }}
      >
        <Icon size={14} style={{ color }} />
      </div>
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "DM Mono, monospace",
            color,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// Crop selector dropdown
function CropSelector({ crops, selectedCrop, onSelect, onClear, t, td }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 12px",
          borderRadius: 10,
          fontSize: 12,
          fontFamily: "DM Mono, monospace",
          cursor: "pointer",
          background: selectedCrop ? "rgba(74,222,128,0.1)" : "var(--surface)",
          border: `1px solid ${selectedCrop ? "rgba(74,222,128,0.35)" : "var(--border)"}`,
          color: selectedCrop ? "var(--green)" : "var(--text-2)",
          flexShrink: 0,
          minWidth: 160,
          justifyContent: "space-between",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Leaf size={12} style={{ flexShrink: 0 }} />
          <span
            style={{
              maxWidth: 110,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {selectedCrop
              ? `${td(selectedCrop.crop)} · ${selectedCrop.cropId}`
              : t("intel_all_crops_filter")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {selectedCrop && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown size={11} style={{ opacity: 0.6 }} />
        </div>
      </button>

      {open && (
        <div
          className="animate-fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            minWidth: 240,
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px 6px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
              }}
            >
              {t("intel_select_crop", { n: crops.length })}
            </div>
          </div>

          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {/* All option */}
            <div
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              style={{
                padding: "9px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: !selectedCrop
                  ? "rgba(74,222,128,0.07)"
                  : "transparent",
                borderBottom: "1px solid var(--border)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = !selectedCrop
                  ? "rgba(74,222,128,0.07)"
                  : "transparent")
              }
            >
              <Database size={12} style={{ color: "var(--text-3)" }} />
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--text-2)",
                  }}
                >
                  {t("intel_all_crops_filter")}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                  {t("intel_fleet_query")}
                </div>
              </div>
            </div>

            {crops.map((c) => {
              const isSelected = selectedCrop?.cropId === c.cropId;
              const statusColor =
                c.status === "Healthy"
                  ? "var(--green)"
                  : c.status === "Attention"
                    ? "var(--amber)"
                    : "var(--red)";
              return (
                <div
                  key={c.cropId}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                  style={{
                    padding: "9px 14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: isSelected
                      ? "rgba(74,222,128,0.07)"
                      : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.04)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = isSelected
                      ? "rgba(74,222,128,0.07)"
                      : "transparent")
                  }
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: statusColor,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "DM Mono, monospace",
                        color: "var(--text)",
                        fontWeight: isSelected ? 700 : 400,
                      }}
                    >
                      {td(c.crop)}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "DM Mono, monospace",
                        color: "var(--text-3)",
                        marginTop: 1,
                      }}
                    >
                      {c.cropId} · {td(c.stage)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "DM Mono, monospace",
                      color: statusColor,
                    }}
                  >
                    {td(c.status.toUpperCase())}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// MAIN
export default function FarmIntelligence() {
  const { t, td, lang } = useT();
  const [textQuery, setTextQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [relatedCrops, setRelatedCrops] = useState([]);
  const [referencedCrops, setReferencedCrops] = useState([]);
  const [transcription, setTranscription] = useState("");
  const [hasQueried, setHasQueried] = useState(false);
  const [llmAnswer, setLlmAnswer] = useState("");
  const [llmThinking, setLlmThinking] = useState("");
  const [queryLogic, setQueryLogic] = useState("");
  const [showQueryLogic, setShowQueryLogic] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [mode, setMode] = useState("ask"); // "search" | "ask"

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const { dashboard } = useFarmData();

  // Build crop list from dashboard
  const cropList = useMemo(() => {
    if (!dashboard?.length) return [];
    return dashboard.map((d) => ({
      crop: d.payload?.crop || t("common_unknown"),
      cropId: d.payload?.crop_id || d.id,
      stage: d.payload?.stage || "",
      status: deriveCropStatus(d.payload),
      payload: d.payload,
    }));
  }, [dashboard, t]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fleetStats = useMemo(
    () => ({
      total: dashboard?.length || 0,
      healthy: (dashboard || []).filter(
        (d) => deriveCropStatus(d.payload) === "Healthy",
      ).length,
      attention: (dashboard || []).filter(
        (d) => deriveCropStatus(d.payload) === "Attention",
      ).length,
      critical: (dashboard || []).filter(
        (d) => deriveCropStatus(d.payload) === "Critical",
      ).length,
    }),
    [dashboard],
  );

  // Build rich context for LLM
  const buildLLMContext = useCallback(
    (cropCtx, similarCrops = []) => {
      const allCrops = dashboard || [];

      if (cropCtx) {
        const p = cropCtx.payload || {};
        const sensors = extractSensors(p);

        // Build similar crops context section
        const similarSection =
          similarCrops.length > 0
            ? `\nSIMILAR CROPS (cosine similarity via vector search):\n` +
              similarCrops
                .map((sc) => {
                  const sp = sc.payload || {};
                  const ss = extractSensors(sp);
                  return `  - ${sp.crop || "?"} (${sp.crop_id || sc.id}): pH=${ss.ph}, EC=${ss.ec}, T=${ss.temp}°, H=${ss.humidity}%, Stage=${sp.stage}, Status=${deriveCropStatus(sp)}, Outcome=${sp.outcome || "Pending"}, Score=${(sc.score * 100).toFixed(0)}%`;
                })
                .join("\n")
            : "";

        return `CROP CONTEXT:
- Crop: ${p.crop || cropCtx.crop}
- Batch ID: ${p.crop_id || cropCtx.cropId}
- Growth Stage: ${p.stage || "Unknown"}
- Sequence Number: ${p.sequence_number || "—"}
- Last Updated: ${p.timestamp ? new Date(p.timestamp).toLocaleString() : "Unknown"}
LATEST SENSOR READINGS:
- pH: ${sensors.ph}
- EC: ${sensors.ec} dS/m
- Temperature: ${sensors.temp}°C
- Humidity: ${sensors.humidity}%
LATEST AGENT DECISION:
- Action Taken: ${p.action_taken && p.action_taken !== "PENDING_ACTION" ? p.action_taken : "None recorded"}
- Outcome: ${p.outcome && p.outcome !== "PENDING_OBSERVATION" ? p.outcome : "Pending"}
- Reward Score: ${p.reward_score ?? "N/A"}
- Strategic Intent: ${p.strategic_intent || "N/A"}
EXPLANATION LOG:
${p.explanation_log && p.explanation_log !== "PENDING_ANALYSIS" ? p.explanation_log : "Not yet generated."}${similarSection}
FLEET OVERVIEW (for comparison):
- Total crops: ${fleetStats.total}
- Healthy: ${fleetStats.healthy}, Needs Attention: ${fleetStats.attention}, Critical: ${fleetStats.critical}`.trim();
      } else {
        // Fleet-wide: pass ALL crops (capped at 20 for prompt size)
        const cropSummaries = allCrops
          .slice(0, 20)
          .map((d) => {
            const p = d.payload || {};
            const s = extractSensors(p);
            return `  - ${p.crop || "?"} (${p.crop_id || d.id}): Stage=${p.stage}, pH=${s.ph}, EC=${s.ec}, T=${s.temp}°, H=${s.humidity}%, Status=${deriveCropStatus(p)}, Outcome=${p.outcome || "Pending"}, Action=${p.action_taken || "Pending"}`;
          })
          .join("\n");
        return `FLEET OVERVIEW:
- Total crops: ${fleetStats.total}
- Healthy: ${fleetStats.healthy}, Needs Attention: ${fleetStats.attention}, Critical: ${fleetStats.critical}
ALL CROPS (${allCrops.length} total):
${cropSummaries || "No crops in database."}
SYSTEM: Hydroponic multi-crop farm management system (Demeter).`.trim();
      }
    },
    [dashboard, fleetStats],
  );

  // Ask LLM
  const handleAsk = useCallback(
    async (q) => {
      const query = q || textQuery;
      if (!query.trim()) return;
      setLoading(true);
      setHasQueried(true);
      setTextQuery(query);
      setLlmAnswer("");
      setLlmThinking("");
      setResults([]);
      setRelatedCrops([]);
      setReferencedCrops([]);
      setTranscription("");

      try {
        let similarCrops = [];

        if (selectedCrop) {
          // Use Qdrant vector search to find cosine-similar crops
          try {
            const searchData = await agentService.querySimilarCrops(
              selectedCrop.cropId,
              selectedCrop.crop,
              selectedCrop.payload,
            );
            if (searchData.results) {
              similarCrops = searchData.results
                .filter((r) => r.payload?.crop_id !== selectedCrop.cropId)
                .slice(0, 5)
                .map((r) => ({
                  id: r.id,
                  score: r.score || 0,
                  payload: r.payload,
                }));
              setRelatedCrops(similarCrops.slice(0, 3));
            }
          } catch (e) {
            console.warn("Similar crop search failed:", e);
          }
        }

        const context = buildLLMContext(selectedCrop, similarCrops);
        const data = await agentService.askDemeter(query, context, lang);

        setLlmThinking(data.thinking || "");
        setLlmAnswer(data.answer || t("intel_no_response"));

        // Parse which crops the answer references (by crop_id mentioned in answer)
        if (!selectedCrop && data.answer) {
          const mentioned = cropList.filter(
            (c) =>
              data.answer.toLowerCase().includes(c.crop.toLowerCase()) ||
              data.answer.includes(c.cropId),
          );
          if (mentioned.length > 0) {
            setReferencedCrops(mentioned.slice(0, 6));
          }
        }
      } catch (e) {
        console.error(e);
        showToast(t("intel_llm_fail_toast"), "error");
        setLlmAnswer(t("intel_llm_fail"));
      } finally {
        setLoading(false);
      }
    },
    [textQuery, selectedCrop, cropList, buildLLMContext, lang, showToast, t],
  );

  // Search
  const handleSearch = useCallback(
    async (q) => {
      const query = q || textQuery;
      if (!query.trim()) return;
      setLoading(true);
      setHasQueried(true);
      setTextQuery(query);
      setResults([]);
      setLlmAnswer("");
      setLlmThinking("");
      setRelatedCrops([]);
      setReferencedCrops([]);
      setQueryLogic("");
      setTranscription("");

      try {
        // Build the search payload — include selectedCrop context so backend
        // can bias Qdrant filter results toward that crop's embedding
        const data = await agentService.queryText(query, selectedCrop?.cropId);

        if (data.results) {
          setResults(
            data.results.map((r) => ({
              id: r.id,
              score: r.score || 1,
              payload: r.payload,
            })),
          );
        }

        if (data.query_logic)
          setQueryLogic(JSON.stringify(data.query_logic, null, 2));

        // If a crop is selected, also show cosine-similar crops in a sidebar section
        if (selectedCrop) {
          try {
            const simData = await agentService.querySimilarCrops(
              selectedCrop.cropId,
              selectedCrop.crop,
              selectedCrop.payload,
            );
            if (simData.results) {
              setRelatedCrops(
                simData.results
                  .filter((r) => r.payload?.crop_id !== selectedCrop.cropId)
                  .slice(0, 3)
                  .map((r) => ({
                    id: r.id,
                    score: r.score || 0,
                    payload: r.payload,
                  })),
              );
            }
          } catch (e) {
            console.warn("Similar crop search failed:", e);
          }
        }
      } catch {
        showToast(t("intel_search_fail_toast"), "error");
      } finally {
        setLoading(false);
      }
    },
    [textQuery, selectedCrop, showToast, t],
  );

  const handleQuery = useCallback(
    (q) => {
      if (mode === "ask") return handleAsk(q);
      return handleSearch(q);
    },
    [mode, handleAsk, handleSearch],
  );

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setLoading(true);
        try {
          const data = await agentService.queryAudio(blob);
          if (data.transcription) {
            setTranscription(data.transcription);
            setTextQuery(data.transcription);

            // In ask mode: hand off transcription to ask handler
            if (mode === "ask") {
              await handleAsk(data.transcription);
            } else {
              // In search mode: if backend returned results use them, else re-query
              if (data.results && data.results.length > 0) {
                setResults(
                  data.results.map((r) => ({
                    id: r.id,
                    score: r.score || 1,
                    payload: r.payload,
                  })),
                );
                if (data.query_logic)
                  setQueryLogic(JSON.stringify(data.query_logic, null, 2));
                setHasQueried(true);
              } else {
                // Fallback: run text search with the transcription
                await handleSearch(data.transcription);
              }
            }
          }
        } finally {
          setLoading(false);
        }
        stream.getTracks().forEach((trk) => trk.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch {
      showToast("Microphone access denied", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Clear transcription banner when user manually types
  const handleInputChange = (e) => {
    setTextQuery(e.target.value);
    if (transcription) setTranscription("");
  };

  const suggestions = selectedCrop
    ? getCropSuggestions(td(selectedCrop.crop), t)
    : getGlobalSuggestions(t);

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

      {toast && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 50,
            padding: "10px 16px",
            borderRadius: 12,
            fontSize: 13,
            fontFamily: "DM Mono, monospace",
            background:
              toast.type === "error"
                ? "rgba(248,113,113,0.15)"
                : "rgba(74,222,128,0.15)",
            border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(74,222,128,0.4)"}`,
            color: toast.type === "error" ? "var(--red)" : "var(--green)",
          }}
        >
          {toast.msg}
        </div>
      )}

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
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(167,139,250,0.1)",
              border: "1px solid rgba(167,139,250,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={15} style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <h1 className="page-title">{t("intel_title")}</h1>
            <p className="page-subtitle">{t("intel_subtitle")}</p>
          </div>

          {/* Mode toggle */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 0,
              borderRadius: 9,
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
              padding: 3,
            }}
          >
            {[
              { key: "search", label: t("intel_search"), icon: Search },
              { key: "ask", label: t("intel_ask_ai"), icon: MessageSquare },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setMode(key);
                  setHasQueried(false);
                  setResults([]);
                  setLlmAnswer("");
                  setLlmThinking("");
                  setRelatedCrops([]);
                  setReferencedCrops([]);
                  setQueryLogic("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 14px",
                  borderRadius: 7,
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  cursor: "pointer",
                  background: mode === key ? "var(--surface)" : "transparent",
                  border: `1px solid ${mode === key ? "var(--border-bright)" : "transparent"}`,
                  color: mode === key ? "var(--text)" : "var(--text-3)",
                  fontWeight: mode === key ? 600 : 400,
                }}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>
        </header>

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
          {/* Fleet stats */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <FleetStat
              label={t("intel_total_crops")}
              value={fleetStats.total}
              color="var(--text-2)"
              icon={Database}
            />
            <FleetStat
              label={t("intel_healthy")}
              value={fleetStats.healthy}
              color="var(--green)"
              icon={TrendingUp}
            />
            <FleetStat
              label={t("intel_needs_attention")}
              value={fleetStats.attention}
              color="var(--amber)"
              icon={Minus}
            />
            <FleetStat
              label={t("intel_critical")}
              value={fleetStats.critical}
              color="var(--red)"
              icon={TrendingDown}
            />
          </div>

          {/* Search / Ask bar */}
          <div>
            {/* Crop selector row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                }}
              >
                {mode === "ask" ? t("intel_ask_about") : t("intel_filter_by")}
              </div>
              <CropSelector
                crops={cropList}
                selectedCrop={selectedCrop}
                onSelect={(c) => {
                  setSelectedCrop(c);
                  // Reset results so user re-queries with crop context
                  setHasQueried(false);
                  setResults([]);
                  setLlmAnswer("");
                  setRelatedCrops([]);
                  setReferencedCrops([]);
                }}
                onClear={() => {
                  setSelectedCrop(null);
                  setHasQueried(false);
                  setResults([]);
                  setLlmAnswer("");
                  setRelatedCrops([]);
                  setReferencedCrops([]);
                }}
                t={t}
                td={td}
              />
            </div>

            {/* Input bar */}
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: 8,
                borderRadius: 14,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  flexShrink: 0,
                  cursor: "pointer",
                  background: isRecording
                    ? "rgba(248,113,113,0.15)"
                    : "var(--bg-3)",
                  border: `1px solid ${isRecording ? "rgba(248,113,113,0.4)" : "var(--border)"}`,
                  color: isRecording ? "var(--red)" : "var(--text-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isRecording ? <Square size={14} /> : <Mic size={14} />}
              </button>

              <input
                value={textQuery}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                placeholder={
                  mode === "ask"
                    ? selectedCrop
                      ? t("intel_ask_placeholder_crop", {
                          crop: td(selectedCrop.crop),
                        })
                      : t("intel_ask_placeholder_fleet")
                    : selectedCrop
                      ? t("intel_search_placeholder_crop", {
                          crop: td(selectedCrop.crop),
                        }) || t("intel_search_placeholder")
                      : t("intel_search_placeholder")
                }
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text)",
                  caretColor: mode === "ask" ? "#a78bfa" : "var(--green)",
                }}
              />

              {textQuery && (
                <button
                  onClick={() => {
                    setTextQuery("");
                    setTranscription("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 4px",
                  }}
                >
                  <X size={13} />
                </button>
              )}

              <button
                onClick={() => handleQuery()}
                disabled={loading}
                style={{
                  padding: "8px 22px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: loading
                    ? "var(--bg-3)"
                    : mode === "ask"
                      ? "#a78bfa"
                      : "var(--green)",
                  color: loading
                    ? "var(--text-3)"
                    : mode === "ask"
                      ? "#1a0a2e"
                      : "#0c1a0e",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {loading ? (
                  <Activity size={13} className="animate-spin" />
                ) : mode === "ask" ? (
                  <>
                    <Sparkles size={12} /> {t("intel_ask_ai").split(" ")[0]}
                  </>
                ) : (
                  <>
                    <Search size={12} /> {t("intel_search")}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Transcription banner */}
          {transcription && !loading && (
            <div
              className="animate-fade-in"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "rgba(167,139,250,0.08)",
                border: "1px solid rgba(167,139,250,0.2)",
                fontSize: 12,
                fontFamily: "DM Mono, monospace",
                color: "#a78bfa",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ flex: 1 }}>🎙 Heard: "{transcription}"</span>
              <button
                onClick={() => setTranscription("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(167,139,250,0.6)",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
              >
                <X size={11} />
              </button>
            </div>
          )}

          {/* Suggestion chips */}
          {!hasQueried && (
            <div>
              <div className="section-label">
                {selectedCrop
                  ? t("intel_suggested_crop", {
                      crop: td(selectedCrop.crop).toUpperCase(),
                    })
                  : t("intel_suggested_global")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setTextQuery(s);
                      handleQuery(s);
                    }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontFamily: "DM Mono, monospace",
                      cursor: "pointer",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-2)",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        mode === "ask"
                          ? "rgba(167,139,250,0.4)"
                          : "rgba(74,222,128,0.4)";
                      e.currentTarget.style.color =
                        mode === "ask" ? "#a78bfa" : "var(--green)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text-2)";
                    }}
                  >
                    {mode === "ask" ? (
                      <MessageSquare size={10} />
                    ) : (
                      <Search size={10} />
                    )}{" "}
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mode === "ask" ? (
                <>
                  <div
                    className="shimmer"
                    style={{
                      height: 48,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <div
                    className="shimmer"
                    style={{
                      height: 180,
                      borderRadius: 14,
                      border: "1px solid var(--border)",
                    }}
                  />
                </>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))",
                    gap: 14,
                  }}
                >
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="shimmer"
                      style={{
                        height: 200,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {!loading && hasQueried && (
            <>
              {/* ── Ask mode: LLM answer ── */}
              {mode === "ask" && (
                <>
                  <LLMAnswerBlock
                    answer={llmAnswer}
                    thinking={llmThinking}
                    cropContext={selectedCrop}
                    referencedCrops={referencedCrops}
                    t={t}
                    td={td}
                  />

                  {/* Similar crops */}
                  {relatedCrops.length > 0 && (
                    <div>
                      <div
                        className="section-label"
                        style={{ marginBottom: 10 }}
                      >
                        <GitBranch
                          size={10}
                          style={{ display: "inline", marginRight: 5 }}
                        />
                        {t("intel_similar_crops")}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(260px,1fr))",
                          gap: 12,
                        }}
                      >
                        {relatedCrops.map((r, i) => (
                          <RelatedCropCard
                            key={r.id || i}
                            item={r}
                            score={r.score}
                            t={t}
                            td={td}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Search mode: crop cards */}
              {mode === "search" && (
                <>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div className="section-label" style={{ margin: 0 }}>
                      {results.length > 0
                        ? t("intel_results_found", { n: results.length })
                        : t("intel_no_results")}
                    </div>
                    {queryLogic && (
                      <button
                        onClick={() => setShowQueryLogic(!showQueryLogic)}
                        style={{
                          marginLeft: "auto",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11,
                          fontFamily: "DM Mono, monospace",
                          padding: "4px 10px",
                          borderRadius: 7,
                          cursor: "pointer",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--text-3)",
                        }}
                      >
                        <BookOpen size={11} />{" "}
                        {showQueryLogic
                          ? t("intel_hide_logic")
                          : t("intel_view_logic")}
                      </button>
                    )}
                  </div>
                  {showQueryLogic && queryLogic && (
                    <div
                      className="animate-fade-in"
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: "var(--bg-3)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="section-label">
                        {t("intel_logic_header")}
                      </div>
                      <pre
                        style={{
                          fontSize: 12,
                          fontFamily: "DM Mono, monospace",
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          color: "var(--text-2)",
                          margin: "8px 0 0",
                        }}
                      >
                        {queryLogic}
                      </pre>
                    </div>
                  )}

                  {results.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 48,
                        gap: 16,
                        borderRadius: 14,
                        background: "var(--surface)",
                        border: "1px dashed var(--border)",
                      }}
                    >
                      <button
                        onClick={() => setMode("ask")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 16px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontFamily: "DM Mono, monospace",
                          cursor: "pointer",
                          background: "rgba(167,139,250,0.08)",
                          border: "1px solid rgba(167,139,250,0.2)",
                          color: "#a78bfa",
                        }}
                      >
                        <Sparkles size={11} /> {t("intel_try_ask")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(320px,1fr))",
                          gap: 14,
                        }}
                      >
                        {results.map((r, i) => (
                          <InsightCard
                            key={r.id}
                            result={r}
                            idx={i}
                            t={t}
                            td={td}
                          />
                        ))}
                      </div>

                      {/* Similar crops section below search results when crop selected */}
                      {relatedCrops.length > 0 && selectedCrop && (
                        <div>
                          <div
                            className="section-label"
                            style={{ marginBottom: 10 }}
                          >
                            <GitBranch
                              size={10}
                              style={{ display: "inline", marginRight: 5 }}
                            />
                            {t("intel_similar_crops")} · {td(selectedCrop.crop)}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fill, minmax(260px,1fr))",
                              gap: 12,
                            }}
                          >
                            {relatedCrops.map((r, i) => (
                              <RelatedCropCard
                                key={r.id || i}
                                item={r}
                                score={r.score}
                                t={t}
                                td={td}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* Empty state */}
          {!hasQueried && !loading && results.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 64,
                gap: 16,
                borderRadius: 14,
                background: "var(--surface)",
                border: "1px dashed var(--border)",
                marginTop: 20,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background:
                    mode === "ask"
                      ? "rgba(167,139,250,0.12)"
                      : "rgba(74,222,128,0.12)",
                  border: `1px solid ${mode === "ask" ? "rgba(167,139,250,0.3)" : "rgba(74,222,128,0.3)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {mode === "ask" ? (
                  <Sparkles size={24} style={{ color: "#a78bfa" }} />
                ) : (
                  <Search size={24} style={{ color: "var(--green)" }} />
                )}
              </div>
              <div style={{ textAlign: "center", maxWidth: 400 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  {mode === "ask"
                    ? t("intel_empty_ask_title")
                    : t("intel_empty_search_title")}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-3)",
                    lineHeight: 1.6,
                  }}
                >
                  {mode === "ask"
                    ? t("intel_empty_ask_desc")
                    : t("intel_empty_search_desc")}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
