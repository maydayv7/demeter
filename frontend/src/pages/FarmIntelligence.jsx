import { useRef, useState, useMemo, useEffect } from "react";
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
  Cpu,
  GitBranch,
  Zap,
  BarChart2,
} from "lucide-react";
import { agentService } from "../api/agentApi";
import { extractSensors } from "../utils/dataUtils";
import {
  AgentActionWidget,
  AgentOutcomeWidget,
} from "../components/AgentWidgets";
import Sidebar from "../components/Sidebar";
import { useFarmData } from "../hooks/useFarmData";
import { deriveCropStatus } from "../utils/dataUtils";

// Suggestion banks
const GLOBAL_SUGGESTIONS = [
  "Show all crops",
  "Which crops are critical?",
  "Find crops in flowering stage",
  "List recent negative outcomes",
  "Show Tomato batches",
  "Find crops with high EC",
];

const CROP_SUGGESTIONS = (crop, cropId) => [
  `Why did we take the last decision for ${crop}?`,
  `Explain the current action for ${cropId}`,
  `Is ${crop} performing well?`,
  `What should I watch out for with ${crop}?`,
  `How has ${crop} been trending lately?`,
  `Compare ${crop} to similar crops`,
];

// Thinking block renderer
function ThinkingBlock({ text }) {
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
          THINKING PROCESS {open ? "▲" : "▼"}
        </span>
        <span
          style={{
            fontSize: 9,
            fontFamily: "DM Mono, monospace",
            color: "var(--text-3)",
          }}
        >
          {text.split("\n").filter(Boolean).length} steps
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
function LLMAnswerBlock({ answer, thinking, query, cropContext }) {
  if (!answer) return null;

  return (
    <div
      className="animate-fade-in"
      style={{
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid rgba(167,139,250,0.25)",
        overflow: "hidden",
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
            DEMETER INTELLIGENCE
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
              Context: {cropContext.crop} · {cropContext.cropId}
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
          {cropContext ? "CROP-AWARE" : "FLEET-WIDE"}
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {/* Thinking */}
        <ThinkingBlock text={thinking} />

        {/* Answer */}
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
      </div>
    </div>
  );
}

// Related crops card
function RelatedCropCard({ item, score }) {
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
            {p.crop || "Unknown"}
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
            {status.toUpperCase()}
          </span>
          {score !== undefined && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                color: scoreColor,
              }}
            >
              {(score * 100).toFixed(0)}% match
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
function InsightCard({ result, idx }) {
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
            {p.crop || "Unknown"}
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
            {status.toUpperCase()}
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
              {p.stage}
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
            LAST COMMAND
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
function CropSelector({ crops, selectedCrop, onSelect, onClear }) {
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
              ? `${selectedCrop.crop} · ${selectedCrop.cropId}`
              : "All Crops"}
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
              SELECT CROP — {crops.length} available
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
                  All Crops
                </div>
                <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                  Fleet-wide query
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
                      {c.crop}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "DM Mono, monospace",
                        color: "var(--text-3)",
                        marginTop: 1,
                      }}
                    >
                      {c.cropId} · {c.stage}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "DM Mono, monospace",
                      color: statusColor,
                    }}
                  >
                    {c.status.toUpperCase()}
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
  const [textQuery, setTextQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [relatedCrops, setRelatedCrops] = useState([]);
  const [transcription, setTranscription] = useState("");
  const [hasQueried, setHasQueried] = useState(false);
  const [llmAnswer, setLlmAnswer] = useState("");
  const [llmThinking, setLlmThinking] = useState("");
  const [queryLogic, setQueryLogic] = useState("");
  const [showQueryLogic, setShowQueryLogic] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [mode, setMode] = useState("search"); // "search" | "ask"

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const { dashboard } = useFarmData();

  // Build crop list from dashboard
  const cropList = useMemo(() => {
    if (!dashboard?.length) return [];
    return dashboard.map((d) => ({
      crop: d.payload?.crop || "Unknown",
      cropId: d.payload?.crop_id || d.id,
      stage: d.payload?.stage || "",
      status: deriveCropStatus(d.payload),
      payload: d.payload,
    }));
  }, [dashboard]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fleetStats = {
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
  };

  // Build rich context for LLM
  const buildLLMContext = (cropCtx) => {
    if (cropCtx) {
      // Specific crop context
      const p = cropCtx.payload || {};
      const sensors = extractSensors(p);

      // Find history from dashboard for same cropId
      const cropDashboardItems = (dashboard || []).filter(
        (d) => d.payload?.crop_id === cropCtx.cropId,
      );

      return `
CROP CONTEXT:
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

EXPLANATION LOG (AI Decision Reasoning):
${p.explanation_log && p.explanation_log !== "PENDING_ANALYSIS" ? p.explanation_log : "Not yet generated."}

FLEET OVERVIEW (for comparison):
- Total crops: ${fleetStats.total}
- Healthy: ${fleetStats.healthy}, Needs Attention: ${fleetStats.attention}, Critical: ${fleetStats.critical}
`.trim();
    } else {
      // Fleet-wide context
      const cropSummaries = (dashboard || [])
        .slice(0, 10)
        .map((d) => {
          const p = d.payload || {};
          const s = extractSensors(p);
          return `  - ${p.crop || "?"} (${p.crop_id || d.id}): Stage=${p.stage}, pH=${s.ph}, EC=${s.ec}, Status=${deriveCropStatus(p)}, Outcome=${p.outcome || "Pending"}`;
        })
        .join("\n");

      return `
FLEET OVERVIEW:
- Total crops: ${fleetStats.total}
- Healthy: ${fleetStats.healthy}, Needs Attention: ${fleetStats.attention}, Critical: ${fleetStats.critical}

CURRENT CROPS:
${cropSummaries || "No crops in database."}

SYSTEM: Hydroponic multi-crop farm management system (Demeter).
`.trim();
    }
  };

  // Ask LLM
  const handleAsk = async (q) => {
    const query = q || textQuery;
    if (!query.trim()) return;
    setLoading(true);
    setHasQueried(true);
    setTextQuery(query);
    setLlmAnswer("");
    setLlmThinking("");
    setResults([]);
    setRelatedCrops([]);

    try {
      const context = buildLLMContext(selectedCrop);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          thinking: { type: "enabled", budget_tokens: 5000 },
          system: `You are Demeter Intelligence, an expert AI agronomist and data analyst for a hydroponic farm management system. 
You have access to live farm data and must answer questions about crop health, agent decisions, and farm performance.
Be specific, cite the actual numbers from the data, and be practical. Keep answers concise but thorough.
When explaining agent decisions, reference the explanation_log if available.`,
          messages: [
            {
              role: "user",
              content: `FARM DATA:\n${context}\n\nQUESTION: ${query}`,
            },
          ],
        }),
      });

      const data = await response.json();

      let thinking = "";
      let answer = "";

      for (const block of data.content || []) {
        if (block.type === "thinking") thinking = block.thinking;
        if (block.type === "text") answer = block.text;
      }

      setLlmThinking(thinking);
      setLlmAnswer(answer || "No response generated.");

      // Also run a search to show related crops
      if (selectedCrop) {
        // For specific crop, show similar crops via vector search
        try {
          const searchData = await agentService.queryText(selectedCrop.crop);
          if (searchData.results) {
            setRelatedCrops(
              searchData.results
                .filter((r) => r.payload?.crop_id !== selectedCrop.cropId)
                .slice(0, 3)
                .map((r) => ({
                  id: r.id,
                  score: r.score || 0.85,
                  payload: r.payload,
                })),
            );
          }
        } catch {
          // Related crops are optional
        }
      }
    } catch (e) {
      console.error(e);
      showToast("LLM query failed", "error");
      setLlmAnswer("Failed to get a response. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Search (Qdrant filter)
  const handleSearch = async (q) => {
    const query = q || textQuery;
    if (!query.trim()) return;
    setLoading(true);
    setHasQueried(true);
    setTextQuery(query);
    setResults([]);
    setLlmAnswer("");
    setLlmThinking("");
    setRelatedCrops([]);
    setQueryLogic("");

    try {
      const data = await agentService.queryText(query);
      if (data.results) {
        setResults(
          data.results.map((r) => ({
            id: r.id,
            score: r.score || 1,
            payload: r.payload,
          })),
        );
      }
      // Show query interpretation if available
      if (data.query_logic)
        setQueryLogic(JSON.stringify(data.query_logic, null, 2));
    } catch {
      showToast("Search failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = (q) => {
    if (mode === "ask") return handleAsk(q);
    return handleSearch(q);
  };

  // Voice
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
          }
          if (data.results) {
            setResults(
              data.results.map((r) => ({
                id: r.id,
                score: r.score || 1,
                payload: r.payload,
              })),
            );
            setHasQueried(true);
          }
        } finally {
          setLoading(false);
        }
        stream.getTracks().forEach((t) => t.stop());
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

  const suggestions = selectedCrop
    ? CROP_SUGGESTIONS(selectedCrop.crop, selectedCrop.cropId)
    : GLOBAL_SUGGESTIONS;

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
            <h1 className="page-title">Farm Intelligence</h1>
            <p className="page-subtitle">
              Query your crops · Ask Demeter anything · Explore patterns
            </p>
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
              { key: "search", label: "Search", icon: Search },
              { key: "ask", label: "Ask AI", icon: MessageSquare },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setMode(key);
                  setHasQueried(false);
                  setResults([]);
                  setLlmAnswer("");
                  setLlmThinking("");
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
              label="Total Crops"
              value={fleetStats.total}
              color="var(--text-2)"
              icon={Database}
            />
            <FleetStat
              label="Healthy"
              value={fleetStats.healthy}
              color="var(--green)"
              icon={TrendingUp}
            />
            <FleetStat
              label="Needs Attention"
              value={fleetStats.attention}
              color="var(--amber)"
              icon={Minus}
            />
            <FleetStat
              label="Critical"
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
                {mode === "ask" ? "ASK ABOUT:" : "FILTER BY:"}
              </div>
              <CropSelector
                crops={cropList}
                selectedCrop={selectedCrop}
                onSelect={setSelectedCrop}
                onClear={() => setSelectedCrop(null)}
              />
              {selectedCrop && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "rgba(74,222,128,0.08)",
                    border: "1px solid rgba(74,222,128,0.2)",
                    fontSize: 10,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--green)",
                  }}
                >
                  <Leaf size={10} />
                  Context loaded — {selectedCrop.stage} ·{" "}
                  {selectedCrop.status === "Healthy"
                    ? "✓ Healthy"
                    : selectedCrop.status === "Attention"
                      ? "⚠ Attention"
                      : "✕ Critical"}
                </div>
              )}
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
                onChange={(e) => setTextQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                placeholder={
                  mode === "ask"
                    ? selectedCrop
                      ? `Ask anything about ${selectedCrop.crop}…`
                      : "Ask anything about your farm — decisions, trends, comparisons…"
                    : "Search crops — 'Show all Tomato', 'Which are critical?', 'Find flowering stage'…"
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
                  onClick={() => setTextQuery("")}
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
                    <Sparkles size={12} /> Ask
                  </>
                ) : (
                  <>
                    <Search size={12} /> Search
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Transcription */}
          {transcription && (
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
              }}
            >
              🎙 Heard: "{transcription}"
            </div>
          )}

          {/* Suggestion chips */}
          {!hasQueried && (
            <div>
              <div className="section-label">
                {selectedCrop
                  ? `SUGGESTED QUESTIONS FOR ${selectedCrop.crop.toUpperCase()}`
                  : "QUICK QUERIES"}
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
                    query={textQuery}
                    cropContext={selectedCrop}
                  />

                  {/* Related crops */}
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
                        SIMILAR CROPS IN DATABASE
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
                        ? `${results.length} RESULT${results.length !== 1 ? "S" : ""} FOUND`
                        : "NO RESULTS"}
                    </div>
                    {results.length > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "DM Mono, monospace",
                          color: "var(--text-3)",
                        }}
                      >
                        for "{textQuery}"
                      </span>
                    )}
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
                        {showQueryLogic ? "Hide" : "View"} query logic
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
                      <div className="section-label">QDRANT FILTER</div>
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
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 16,
                          background: "var(--bg-3)",
                          border: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Brain size={22} style={{ color: "var(--text-3)" }} />
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--text-2)",
                          }}
                        >
                          No crops matched
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-3)",
                            marginTop: 6,
                          }}
                        >
                          Try a different query or switch to Ask AI mode for
                          natural language questions.
                        </div>
                      </div>
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
                        <Sparkles size={11} /> Try Ask AI instead
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(320px,1fr))",
                        gap: 14,
                      }}
                    >
                      {results.map((r, i) => (
                        <InsightCard key={r.id} result={r} idx={i} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Empty state */}
          {!hasQueried && !loading && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 48,
                gap: 20,
                borderRadius: 16,
                background: "var(--surface)",
                border: "1px dashed var(--border)",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: "rgba(167,139,250,0.1)",
                  border: "1px solid rgba(167,139,250,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={28} style={{ color: "#a78bfa" }} />
              </div>
              <div style={{ textAlign: "center", maxWidth: 420 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "var(--text)",
                  }}
                >
                  {mode === "ask"
                    ? "Ask Demeter anything about your farm"
                    : "Search your crop database"}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-3)",
                    marginTop: 8,
                    lineHeight: 1.6,
                  }}
                >
                  {mode === "ask"
                    ? "Select a specific crop for targeted questions, or ask fleet-wide questions. The AI uses live sensor data, agent decisions, and explanation logs to answer."
                    : "Use natural language to filter crops by type, stage, status or outcome. The supervisor translates your query into precise database filters."}
                </div>
              </div>

              {mode === "ask" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    width: "100%",
                    maxWidth: 440,
                  }}
                >
                  {[
                    {
                      icon: Cpu,
                      label: "Decision Reasoning",
                      desc: "Why did the agent take this action?",
                    },
                    {
                      icon: BarChart2,
                      label: "Performance Analysis",
                      desc: "How is my crop trending?",
                    },
                    {
                      icon: GitBranch,
                      label: "Comparative Insights",
                      desc: "How does this compare to other crops?",
                    },
                    {
                      icon: Zap,
                      label: "Actionable Advice",
                      desc: "What should I do next?",
                    },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 16px",
                        borderRadius: 10,
                        background: "var(--bg-3)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <Icon
                        size={14}
                        style={{ color: "#a78bfa", flexShrink: 0 }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--text-2)",
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-3)",
                            marginTop: 1,
                          }}
                        >
                          {desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
