import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useT } from "../hooks/useTranslation";
import {
  Upload,
  ArrowLeft,
  Activity,
  Droplets,
  Thermometer,
  Wind,
  Play,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Waves,
  FlaskConical,
  Cpu,
  Leaf,
  RotateCcw,
  Zap,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  IconButton,
  SectionCard,
} from "../components/ui";
import { fetchCropById } from "../api/farmApi";
import {
  extractSensors,
  getCurrentStage,
  calculateMaturity,
  getDaysRemaining,
  CROP_LIFECYCLES,
} from "../utils/dataUtils";
import { AgentActionWidget } from "../components/AgentWidgets";

// Agent log helpers

const AGENT_META = {
  FETCHER: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)", label: "Fetcher" },
  JUDGE: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Judge" },
  RESEARCHER: {
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    label: "Researcher",
  },
  ATMOSPHERIC: {
    color: "#4ade80",
    bg: "rgba(74,222,128,0.12)",
    label: "Atmospheric",
  },
  WATER: { color: "#22d3ee", bg: "rgba(34,211,238,0.12)", label: "Water" },
  SUPERVISOR: {
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    label: "Supervisor",
  },
  BANDIT: { color: "#e879f9", bg: "rgba(232,121,249,0.12)", label: "Bandit" },
  DOCTOR: { color: "#f87171", bg: "rgba(248,113,113,0.12)", label: "Doctor" },
  SYSTEM: { color: "#6a8a6d", bg: "rgba(106,138,109,0.12)", label: "System" },
};

function agentFromLine(line) {
  const up = line.toUpperCase();
  if (up.includes("[FETCHER]") || up.includes("FETCHING")) return "FETCHER";
  if (up.includes("[JUDGE]") || up.includes("JUDGE")) return "JUDGE";
  if (up.includes("BANDIT") || up.includes("STRATEGY")) return "BANDIT";
  if (up.includes("RESEARCH")) return "RESEARCHER";
  if (up.includes("ATMO") || up.includes("ATMOSPHERIC")) return "ATMOSPHERIC";
  if (up.includes("WATER") || up.includes("NUTRIENT")) return "WATER";
  if (up.includes("SUPERVISOR")) return "SUPERVISOR";
  if (up.includes("DOCTOR") || up.includes("VISION") || up.includes("DIAGNOS"))
    return "DOCTOR";
  return "SYSTEM";
}

function levelFromLine(line) {
  const up = line.toUpperCase();
  if (up.includes("❌") || up.includes("ERROR") || up.includes("CRITICAL"))
    return "error";
  if (up.includes("⚠️") || up.includes("WARN") || up.includes("FAIL"))
    return "warn";
  if (up.includes("✅") || up.includes("APPROV") || up.includes("SUCCESS"))
    return "success";
  return "info";
}

const LEVEL_COLORS = {
  error: "var(--red)",
  warn: "var(--amber)",
  success: "var(--green)",
  info: "var(--text-2)",
};

function phaseFromLogs(logs) {
  const last = logs[logs.length - 1]?.text?.toUpperCase() || "";
  if (last.includes("SENT TO SIMULATOR") || last.includes("CYCLE COMPLETE"))
    return "execute";
  if (last.includes("ACTIVATING") || last.includes("SUPERVISOR"))
    return "execute";
  if (
    last.includes("WATER") ||
    last.includes("ATMOSPHERIC") ||
    last.includes("MERGING")
  )
    return "plan";
  if (last.includes("RESEARCH") || last.includes("KNOWLEDGE"))
    return "research";
  if (last.includes("BANDIT") || last.includes("STRATEGY")) return "strategy";
  if (last.includes("JUDGE")) return "judge";
  if (last.includes("FETCHER") || last.includes("FMU")) return "fetch";
  return null;
}

function LogLine({ entry, idx }) {
  const agent = AGENT_META[entry.agent] || AGENT_META.SYSTEM;
  const lvlColor = LEVEL_COLORS[entry.level] || LEVEL_COLORS.info;
  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "5px 0",
        borderBottom: "1px solid rgba(128,180,128,0.06)",
        animationDelay: `${Math.min(idx * 20, 300)}ms`,
      }}
    >
      {/* Line number */}
      <span
        style={{
          fontSize: 9,
          fontFamily: "DM Mono, monospace",
          color: "var(--text-3)",
          minWidth: 26,
          paddingTop: 2,
          opacity: 0.5,
        }}
      >
        {String(idx + 1).padStart(3, "0")}
      </span>
      {/* Timestamp */}
      <span
        style={{
          fontSize: 9,
          fontFamily: "DM Mono, monospace",
          color: "var(--text-3)",
          minWidth: 58,
          paddingTop: 2,
          flexShrink: 0,
        }}
      >
        {entry.time}
      </span>
      {/* Agent badge */}
      <span
        style={{
          fontSize: 8,
          fontFamily: "DM Mono, monospace",
          padding: "2px 6px",
          borderRadius: 4,
          background: agent.bg,
          color: agent.color,
          border: `1px solid ${agent.color}30`,
          flexShrink: 0,
          minWidth: 76,
          textAlign: "center",
          marginTop: 1,
          letterSpacing: "0.03em",
        }}
      >
        {agent.label.toUpperCase()}
      </span>
      {/* Message */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "DM Mono, monospace",
          color: lvlColor,
          flex: 1,
          wordBreak: "break-word",
          lineHeight: 1.55,
        }}
      >
        {entry.text}
      </span>
    </div>
  );
}

// Pipeline phase config
const PIPELINE_PHASES = [
  { id: "fetch", label: "Fetch", icon: Waves },
  { id: "judge", label: "Judge", icon: AlertTriangle },
  { id: "strategy", label: "Strategy", icon: Brain },
  { id: "research", label: "Research", icon: FlaskConical },
  { id: "plan", label: "Plan", icon: Cpu },
  { id: "execute", label: "Execute", icon: Zap },
];
const PHASE_ORDER = PIPELINE_PHASES.map((p) => p.id);

// MAIN

export default function RunCycle() {
  const { cropId } = useParams();
  const navigate = useNavigate();
  const { t } = useT();
  const AGENT_API =
    process.env.REACT_APP_AGENT_API_URL || "http://localhost:8000";

  const [cropDoc, setCropDoc] = useState(null);
  const [loadingCrop, setLoadingCrop] = useState(true);
  const [sensors, setSensors] = useState({
    pH: "6.0",
    EC: "1.4",
    temp: "24.0",
    humidity: "65.0",
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | running | done | error
  const [logs, setLogs] = useState([]);
  const [cycles, setCycles] = useState(0);
  const [activePhase, setActivePhase] = useState(null);
  const [finalAction, setFinalAction] = useState(null);
  const [toast, setToast] = useState(null);

  const logEndRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    if (!cropId) return;
    fetchCropById(cropId).then((doc) => {
      if (doc) {
        setCropDoc(doc);
        const s = extractSensors(doc);
        setSensors({
          pH: String(s.ph),
          EC: String(s.ec),
          temp: String(s.temp),
          humidity: String(s.humidity),
        });
      }
      setLoadingCrop(false);
    });
  }, [cropId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const pushLog = useCallback((text, agentKey) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const agent = agentKey || agentFromLine(text);
    const level = levelFromLine(text);
    setLogs((prev) => {
      const updated = [...prev, { text, time, agent, level }];
      const newPhase = phaseFromLogs(updated);
      if (newPhase) setActivePhase(newPhase);
      return updated;
    });
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const r = new FileReader();
    r.onload = (ev) => setPreview(ev.target.result);
    r.readAsDataURL(f);
  };

  const runCycle = async () => {
    setPhase("running");
    setLogs([]);
    setActivePhase("fetch");
    setFinalAction(null);

    const cropName = cropDoc?.crop || "Unknown";
    const stage = cropDoc?.stage || "seedling";
    const cropIdVal = cropDoc?.crop_id || cropId;

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        await new Promise((res) =>
          canvas.toBlob((b) => {
            formData.append("file", b, "placeholder.png");
            res();
          }),
        );
      }
      formData.append(
        "sensors",
        JSON.stringify({
          pH: parseFloat(sensors.pH),
          EC: parseFloat(sensors.EC),
          temp: parseFloat(sensors.temp),
          humidity: parseFloat(sensors.humidity),
          crop_id: cropIdVal,
        }),
      );
      formData.append(
        "metadata",
        JSON.stringify({ crop: cropName, stage, crop_id: cropIdVal }),
      );

      pushLog(
        `Starting cycle for ${cropIdVal} (${cropName} - ${stage})`,
        "FETCHER",
      );

      const res = await fetch(`${AGENT_API}/run-cycle-stream`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith("data:")) {
            const raw = trimmed.slice(5).trim();
            if (raw === "[DONE]") {
              setPhase("done");
              setCycles((c) => c + 1);
              break;
            }
            try {
              const parsed = JSON.parse(raw);
              const msg = parsed.log || parsed.text;
              if (msg) pushLog(msg, parsed.agent?.toUpperCase?.());
              if (parsed.action || parsed.final_action) {
                setFinalAction(parsed.action || parsed.final_action);
                pushLog("✅ Final action dispatched to hardware", "SUPERVISOR");
              }
              if (parsed.phase === "done") {
                setPhase("done");
                setCycles((c) => c + 1);
                showToast(t("add_cycle_done"));
              }
            } catch {
              pushLog(raw);
            }
          } else {
            pushLog(trimmed);
          }
        }
      }

      setPhase("done");
      setCycles((c) => c + 1);
      showToast(t("add_cycle_done"));
    } catch (err) {
      setPhase("error");
      pushLog(`❌ ${err.message || t("add_cycle_fail")}`, "SYSTEM");
      showToast(t("add_cycle_fail"), "error");
    }
  };

  // Derived values
  const cropName = cropDoc?.crop || cropId;
  const maturity = cropDoc ? calculateMaturity(cropDoc) : 0;
  const daysLeft = cropDoc ? getDaysRemaining(cropDoc) : null;
  const lifecycle = CROP_LIFECYCLES[(cropDoc?.crop || "").toLowerCase()];
  const curStage = cropDoc
    ? getCurrentStage(cropDoc) || cropDoc?.stage || "-"
    : "-";

  if (loadingCrop) {
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
            Loading crop…
          </span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Toast */}
      {toast && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 12,
            background:
              toast.type === "error"
                ? "rgba(248,113,113,0.15)"
                : "rgba(74,222,128,0.15)",
            border: `1px solid ${toast.type === "error" ? "var(--red)" : "var(--green)"}`,
            color: toast.type === "error" ? "var(--red)" : "var(--green)",
            fontFamily: "DM Mono, monospace",
            fontSize: 13,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <PageHeader>
        <IconButton onClick={() => navigate(`/crop/${cropId}`)}>
          <ArrowLeft size={15} />
        </IconButton>
        <div>
          <h1 className="page-title">{t("run_title")}</h1>
          <p className="page-subtitle">
            {t("run_for_crop", { crop: cropName })}
          </p>
        </div>
      </PageHeader>

      {phase === "done" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid rgba(74,222,128,0.15)",
            background: "rgba(74,222,128,0.06)",
          }}
        >
          <CheckCircle2 size={13} style={{ color: "var(--green)" }} />
          <span
            style={{
              fontSize: 12,
              fontFamily: "DM Mono, monospace",
              color: "var(--green)",
              fontWeight: 600,
            }}
          >
            {cycles} cycle{cycles !== 1 ? "s" : ""} completed
          </span>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Crop Info */}
        {cropDoc && (
          <SectionCard>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              {/* Crop avatar */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(74,222,128,0.1)",
                  border: "1px solid rgba(74,222,128,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Leaf size={24} style={{ color: "var(--green)" }} />
              </div>

              {/* Name + stage */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "var(--text)",
                  }}
                >
                  {cropName}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 4,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "DM Mono, monospace",
                      color: "var(--text-3)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--bg-3)",
                      border: "1px solid var(--border)",
                      textTransform: "capitalize",
                    }}
                  >
                    {curStage}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "DM Mono, monospace",
                      color: "var(--text-3)",
                    }}
                  >
                    {cropId}
                  </span>
                  {daysLeft !== null && (
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "DM Mono, monospace",
                        color: daysLeft === 0 ? "var(--green)" : "var(--amber)",
                      }}
                    >
                      {daysLeft === 0
                        ? "✂ Ready to harvest"
                        : `${daysLeft}d until harvest`}
                    </span>
                  )}
                </div>
              </div>

              {/* Lifecycle progress bar */}
              <div style={{ minWidth: 300 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "DM Mono, monospace",
                      color: "var(--text-3)",
                    }}
                  >
                    Growth Progress
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "DM Mono, monospace",
                      fontWeight: 700,
                      color:
                        maturity >= 95
                          ? "var(--green)"
                          : maturity >= 70
                            ? "var(--amber)"
                            : "var(--blue)",
                    }}
                  >
                    {maturity}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${maturity}%`,
                      height: "100%",
                      borderRadius: 3,
                      background:
                        maturity >= 95
                          ? "var(--green)"
                          : maturity >= 70
                            ? "var(--amber)"
                            : "linear-gradient(90deg, #22d3ee, #4ade80)",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
                {/* Stage labels */}
                {lifecycle && (
                  <div style={{ display: "flex", marginTop: 5, gap: 0 }}>
                    {lifecycle.stages.map((s, i) => {
                      const endH = s.endH ?? lifecycle.totalHours;
                      const w =
                        ((endH - s.startH) / lifecycle.totalHours) * 100;
                      const stageColors = [
                        "var(--text-3)",
                        "#22d3ee",
                        "var(--amber)",
                        "var(--green)",
                      ];
                      return (
                        <div
                          key={s.name}
                          style={{ width: `${w}%`, textAlign: "center" }}
                          title={`${s.name}: ${Math.round((s.endH ?? lifecycle.totalHours - s.startH) / 24)}d`}
                        >
                          <div
                            style={{
                              height: 3,
                              background: stageColors[i % stageColors.length],
                              opacity: 0.5,
                              marginBottom: 3,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 8,
                              fontFamily: "DM Mono, monospace",
                              color: stageColors[i % stageColors.length],
                              textTransform: "capitalize",
                              opacity: 0.8,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              display: "block",
                            }}
                          >
                            {s.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        )}

        {/* Pipeline Progress Bar */}
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 14,
            background: "var(--bg-3)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${PIPELINE_PHASES.length}, 1fr)`,
              gap: 4,
              alignItems: "start",
            }}
          >
            {PIPELINE_PHASES.map((p, i) => {
              const pIdx = PHASE_ORDER.indexOf(p.id);
              const activeIdx = PHASE_ORDER.indexOf(activePhase || "");
              const isDone = phase === "done" || pIdx < activeIdx;
              const isActive = p.id === activePhase && phase === "running";
              const PIcon = p.icon;

              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    position: "relative",
                  }}
                >
                  {/* Connector line */}
                  {i < PIPELINE_PHASES.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 18,
                        left: "calc(50% + 14px)",
                        right: "calc(-50% + 14px)",
                        height: 1,
                        background: isDone
                          ? "rgba(74,222,128,0.5)"
                          : "var(--border)",
                        transition: "background 0.4s",
                      }}
                    />
                  )}

                  {/* Circle icon */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: isDone
                        ? "rgba(74,222,128,0.15)"
                        : isActive
                          ? "rgba(74,222,128,0.08)"
                          : "var(--bg-2)",
                      border: `2px solid ${
                        isDone
                          ? "rgba(74,222,128,0.5)"
                          : isActive
                            ? "rgba(74,222,128,0.4)"
                            : "var(--border)"
                      }`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.3s",
                      zIndex: 1,
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2
                        size={14}
                        style={{ color: "var(--green)" }}
                      />
                    ) : isActive ? (
                      <PIcon
                        size={14}
                        style={{
                          color: "var(--green)",
                          animation: "spin 1.5s linear infinite",
                        }}
                      />
                    ) : (
                      <PIcon
                        size={14}
                        style={{ color: "var(--text-3)", opacity: 0.4 }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "DM Mono, monospace",
                      color: isDone
                        ? "var(--green)"
                        : isActive
                          ? "var(--green)"
                          : "var(--text-3)",
                      fontWeight: isActive ? 700 : 400,
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sensor Inputs */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 12 }}>
            {t("add_sensor_params")}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {[
              {
                label: t("add_field_ph"),
                name: "pH",
                icon: Droplets,
                color: "var(--blue)",
                step: "0.1",
                min: "0",
                max: "14",
              },
              {
                label: t("add_field_ec"),
                name: "EC",
                icon: Activity,
                color: "var(--amber)",
                step: "0.1",
              },
              {
                label: t("add_field_temp"),
                name: "temp",
                icon: Thermometer,
                color: "var(--red)",
                step: "0.5",
              },
              {
                label: t("add_field_humidity"),
                name: "humidity",
                icon: Wind,
                color: "#a78bfa",
                step: "1",
              },
            ].map(({ label, name, icon: Icon, color, step, min, max }) => (
              <div
                key={name}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "var(--bg-3)",
                  border: "1px solid var(--border)",
                  transition: "border-color 150ms",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Icon size={12} style={{ color }} />
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
                <input
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={sensors[name]}
                  onChange={(e) =>
                    setSensors((s) => ({ ...s, [name]: e.target.value }))
                  }
                  disabled={phase === "running"}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    outline: "none",
                    color,
                    fontFamily: "DM Mono, monospace",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Image Upload */}
        <SectionCard>
          <div className="section-label" style={{ marginBottom: 12 }}>
            {t("add_plant_image")}
          </div>
          {preview ? (
            <div
              style={{
                position: "relative",
                borderRadius: 12,
                overflow: "hidden",
                height: 160,
              }}
            >
              <img
                src={preview}
                alt="crop"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: 24,
                borderRadius: 12,
                border: "2px dashed var(--border)",
                cursor: "pointer",
                background: "var(--bg-3)",
              }}
            >
              <Upload size={22} style={{ color: "var(--text-3)" }} />
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                }}
              >
                {t("add_drop_image")}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  opacity: 0.6,
                  fontFamily: "DM Mono, monospace",
                }}
              >
                {t("add_image_hint")}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>
          )}
        </SectionCard>

        {/* Agent Log */}
        {(logs.length > 0 || phase === "running") && (
          <SectionCard>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="section-label">
                  {phase === "running"
                    ? "🔴 Live Agent Feed"
                    : phase === "done"
                      ? "✅ Cycle Log"
                      : "Agent Log"}
                </div>
                {phase === "running" && (
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "DM Mono, monospace",
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: "rgba(248,113,113,0.12)",
                      color: "var(--red)",
                      border: "1px solid rgba(248,113,113,0.3)",
                      animation: "pulse 1.5s ease-in-out infinite",
                      alignSelf: "center",
                    }}
                  >
                    STREAMING
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                }}
              >
                {logs.length} lines
              </span>
            </div>

            {/* Terminal-style log box */}
            <div
              style={{
                background: "rgba(0,0,0,0.25)",
                borderRadius: 10,
                border: "1px solid rgba(128,180,128,0.1)",
                padding: "10px 12px",
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {logs.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    color: "var(--text-3)",
                    fontFamily: "DM Mono, monospace",
                    fontSize: 11,
                  }}
                >
                  Waiting for agent output…
                </div>
              ) : (
                logs.map((entry, i) => (
                  <LogLine key={i} entry={entry} idx={i} />
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </SectionCard>
        )}

        {/* Final Action */}
        {finalAction && (
          <SectionCard>
            <div className="section-label" style={{ marginBottom: 12 }}>
              {t("add_actuator_dispatched")}
            </div>
            <AgentActionWidget actionTaken={finalAction} compact={false} />
          </SectionCard>
        )}

        {/* Run Button */}
        <div style={{ paddingBottom: 24 }}>
          <button
            onClick={phase === "running" ? undefined : runCycle}
            disabled={phase === "running"}
            style={{
              width: "100%",
              padding: "16px 24px",
              borderRadius: 14,
              background:
                phase === "running"
                  ? "rgba(74,222,128,0.06)"
                  : phase === "done"
                    ? "rgba(74,222,128,0.12)"
                    : "var(--green)",
              border:
                phase === "running"
                  ? "1px solid rgba(74,222,128,0.2)"
                  : phase === "done"
                    ? "1px solid rgba(74,222,128,0.35)"
                    : "none",
              color:
                phase === "running"
                  ? "var(--green)"
                  : phase === "done"
                    ? "var(--green)"
                    : "var(--btn-on-green)",
              fontWeight: 700,
              fontSize: 15,
              cursor: phase === "running" ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transition: "all 0.2s",
              letterSpacing: "0.02em",
            }}
          >
            {phase === "running" ? (
              <>
                <Brain size={18} style={{ animation: "pulse 1s infinite" }} />
                Agents Working…
              </>
            ) : phase === "done" ? (
              <>
                <RotateCcw size={17} />
                Run Another Cycle
              </>
            ) : (
              <>
                <Play size={17} />
                {t("run_title")}
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1;   }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </PageShell>
  );
}
