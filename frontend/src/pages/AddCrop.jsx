import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFarmData } from "../hooks/useFarmData";
import { useT } from "../hooks/useTranslation";
import {
  Upload,
  ArrowLeft,
  Activity,
  Droplets,
  Thermometer,
  Wind,
  Sprout,
  Calendar,
  Database,
  Play,
  CheckCircle2,
  AlertTriangle,
  Fan,
  Brain,
  ChevronDown,
  Leaf,
  Zap,
  Circle,
  ChevronRight,
  Waves,
  FlaskConical,
  Cpu,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

// Agent Formatting
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

const getInputFields = (t) => [
  {
    label: t("add_field_ph"),
    name: "pH",
    icon: Droplets,
    color: "var(--green)",
    type: "number",
    step: "0.1",
    min: "0",
    max: "14",
    hint: t("sensor_ph_desc"),
  },
  {
    label: t("add_field_ec"),
    name: "EC",
    icon: Activity,
    color: "var(--amber)",
    type: "number",
    step: "0.1",
    hint: t("sensor_ec_desc"),
  },
  {
    label: t("add_field_temp"),
    name: "temp",
    icon: Thermometer,
    color: "var(--blue)",
    type: "number",
    step: "0.5",
    hint: t("sensor_temp_desc"),
  },
  {
    label: t("add_field_humidity"),
    name: "humidity",
    icon: Wind,
    color: "#a78bfa",
    type: "number",
    step: "1",
    hint: t("sensor_humidity_desc"),
  },
  {
    label: t("add_field_crop_type"),
    name: "crop",
    icon: Sprout,
    color: "var(--green)",
    type: "select",
    opts: [
      "Lettuce",
      "Tomato",
      "Cucumber",
      "Basil",
      "Spinach",
      "Kale",
      "Strawberry",
      "Pepper",
    ],
  },
  {
    label: t("add_field_stage"),
    name: "stage",
    icon: Calendar,
    color: "var(--text-3)",
    type: "select",
    opts: ["Seedling", "Vegetative", "Flowering", "Fruiting"],
    hint: t("add_field_stage_hint"),
  },
  {
    label: t("add_field_crop_id"),
    name: "crop_id",
    icon: Database,
    color: "var(--text-3)",
    type: "text",
    placeholder: t("add_field_crop_id_placeholder"),
    hint: t("add_field_crop_id_hint"),
  },
];

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

function LogLine({ entry, idx, td }) {
  const agent = AGENT_META[entry.agent] || AGENT_META.SYSTEM;
  const lvlColor = LEVEL_COLORS[entry.level] || LEVEL_COLORS.info;

  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "5px 0",
        borderBottom: "1px solid rgba(128,180,128,0.06)",
        animationDelay: `${idx * 20}ms`,
      }}
    >
      {/* Line number */}
      <span
        style={{
          fontSize: 10,
          fontFamily: "DM Mono, monospace",
          color: "var(--text-3)",
          minWidth: 28,
          paddingTop: 2,
        }}
      >
        {String(idx + 1).padStart(3, "0")}
      </span>
      {/* Timestamp */}
      <span
        style={{
          fontSize: 10,
          fontFamily: "DM Mono, monospace",
          color: "var(--text-3)",
          minWidth: 54,
          paddingTop: 2,
          flexShrink: 0,
        }}
      >
        {entry.time}
      </span>
      {/* Agent badge */}
      <span
        style={{
          fontSize: 9,
          fontFamily: "DM Mono, monospace",
          padding: "2px 7px",
          borderRadius: 4,
          background: agent.bg,
          color: agent.color,
          border: `1px solid ${agent.color}30`,
          flexShrink: 0,
          minWidth: 80,
          textAlign: "center",
          marginTop: 1,
        }}
      >
        {td(agent.label)}
      </span>
      {/* Message */}
      <span
        style={{
          fontSize: 12,
          fontFamily: "DM Mono, monospace",
          color: lvlColor,
          flex: 1,
          wordBreak: "break-all",
          lineHeight: 1.5,
        }}
      >
        {td(entry.text)}
      </span>
    </div>
  );
}

// MAIN
export default function AddCrop() {
  const navigate = useNavigate();
  const { refreshData } = useFarmData();
  const { t, td } = useT();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sensors, setSensors] = useState({
    pH: "6.0",
    EC: "1.4",
    temp: "24.0",
    humidity: "65",
    crop: "Lettuce",
    stage: "Vegetative",
    crop_id: "",
  });

  const [phase, setPhase] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [cycles, setCycles] = useState(0);
  const [activePhase, setActivePhase] = useState(null);
  const [finalAction, setFinalAction] = useState(null);
  const [toast, setToast] = useState(null);

  const logEndRef = useRef(null);
  const timersRef = useRef([]);

  const AGENT_API =
    process.env.REACT_APP_AGENT_API_URL || "http://localhost:8000";

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Cleanup timers on unmount
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const pushLog = useCallback((text, agentKey) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const agent = agentKey || agentFromLine(text);
    const level = levelFromLine(text);
    setLogs((prev) => [...prev, { text, agent, level, time }]);
  }, []);

  async function startCycle() {
    if (phase === "running") return;

    setPhase("running");
    setLogs([]);
    setFinalAction(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        // Placeholder 1x1 png
        const r = await fetch(
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        );
        const blob = await r.blob();
        formData.append(
          "file",
          new File([blob], "placeholder.png", { type: "image/png" }),
        );
      }
      formData.append(
        "sensors",
        JSON.stringify({
          pH: parseFloat(sensors.pH),
          EC: parseFloat(sensors.EC),
          temp: parseFloat(sensors.temp),
          humidity: parseFloat(sensors.humidity),
          crop: sensors.crop,
          stage: sensors.stage,
          crop_id: sensors.crop_id || undefined,
        }),
      );

      const response = await fetch(`${AGENT_API}/run-cycle-stream`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Backend connection failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            try {
              const msg = JSON.parse(part.replace("data: ", ""));
              pushLog(msg.text, msg.agent);
              if (msg.final_action) setFinalAction(msg.final_action);
              if (msg.phase === "done") {
                setPhase("done");
                setCycles((c) => c + 1);
                refreshData();
                showToast(t("add_cycle_done"));
              }
            } catch (e) {
              console.error("Parse error", e);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setPhase("error");
      pushLog(`❌ Connection Error: ${err.message}`, "SYSTEM");
      showToast(t("add_cycle_fail"), "error");
    }
  }

  // Track active pipeline phase from logs
  useEffect(() => {
    if (logs.length) setActivePhase(phaseFromLogs(logs));
  }, [logs]);

  const handleFile = (e) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const CYCLE_PHASES = [
    { key: "fetch", label: t("add_phase_fetch"), icon: Database },
    { key: "judge", label: t("add_phase_judge"), icon: Zap },
    { key: "strategy", label: t("add_phase_strategy"), icon: Brain },
    { key: "research", label: t("add_phase_research"), icon: Leaf },
    { key: "plan", label: t("add_phase_plan"), icon: Cpu },
    { key: "execute", label: t("add_phase_execute"), icon: Play },
  ];

  const phaseIndex = CYCLE_PHASES.findIndex((p) => p.key === activePhase);
  const INPUT_FIELDS = getInputFields(t);

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

      {/* Toast */}
      {toast && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            padding: "12px 24px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "DM Mono, monospace",
            background:
              toast.type === "error"
                ? "rgba(248,113,113,0.95)"
                : "rgba(34,197,94,0.95)",
            border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(74,222,128,0.4)"}`,
            color: "white",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {toast.type === "error" ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
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

          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sprout size={15} style={{ color: "var(--green)" }} />
          </div>

          <div>
            <h1 className="page-title">{t("add_title")}</h1>
            <p className="page-subtitle">{t("add_subtitle")}</p>
          </div>

          {/* Cycle counter */}
          {cycles > 0 && (
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 14px",
                borderRadius: 20,
                background: "rgba(74,222,128,0.1)",
                border: "1px solid rgba(74,222,128,0.25)",
                fontSize: 12,
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
              {t("add_cycles_done", { n: cycles, s: cycles !== 1 ? "S" : "" })}
            </div>
          )}
        </header>

        {/* Pipeline phase strip */}
        {phase === "running" && (
          <div
            className="animate-fade-in"
            style={{
              flexShrink: 0,
              padding: "10px 24px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-3)",
              display: "flex",
              alignItems: "center",
              gap: 0,
              overflowX: "auto",
            }}
          >
            {CYCLE_PHASES.map((p, i) => {
              const done = phaseIndex > i;
              const current = phaseIndex === i;
              return (
                <div
                  key={p.key}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 20,
                      flexShrink: 0,
                      background: current
                        ? "rgba(74,222,128,0.15)"
                        : done
                          ? "rgba(74,222,128,0.07)"
                          : "transparent",
                      border: `1px solid ${current ? "rgba(74,222,128,0.4)" : done ? "rgba(74,222,128,0.2)" : "transparent"}`,
                      transition: "all 0.3s",
                    }}
                  >
                    {done ? (
                      <CheckCircle2
                        size={12}
                        style={{ color: "var(--green)" }}
                      />
                    ) : current ? (
                      <Activity
                        size={12}
                        style={{ color: "var(--green)" }}
                        className="animate-spin"
                      />
                    ) : (
                      <Circle size={12} style={{ color: "var(--text-3)" }} />
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "DM Mono, monospace",
                        color:
                          current || done ? "var(--green)" : "var(--text-3)",
                        fontWeight: current ? 700 : 400,
                      }}
                    >
                      {p.label}
                    </span>
                  </div>
                  {i < CYCLE_PHASES.length - 1 && (
                    <ChevronRight
                      size={12}
                      style={{
                        color: done ? "var(--green)" : "var(--border)",
                        margin: "0 2px",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Main content */}
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
          {/* Top grid: image + sensors */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}
          >
            {/* Image upload */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="section-label">{t("add_plant_image")}</div>
              <label
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  position: "relative",
                  display: "block",
                  borderRadius: 16,
                  overflow: "hidden",
                  cursor: "pointer",
                  height: 260,
                  background: "var(--surface)",
                  border: preview
                    ? "2px solid rgba(74,222,128,0.3)"
                    : "2px dashed var(--border)",
                  transition: "border-color 0.2s",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                    zIndex: 10,
                  }}
                />
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(to top, rgba(12,26,14,0.5) 0%, transparent 60%)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: 12,
                        right: 12,
                        fontSize: 11,
                        fontFamily: "DM Mono, monospace",
                        color: "var(--text-2)",
                      }}
                    >
                      {file?.name?.slice(0, 30)}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      gap: 14,
                      padding: 24,
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
                      <Upload size={22} style={{ color: "var(--text-3)" }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "var(--text-2)",
                        }}
                      >
                        {t("add_drop_image")}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          marginTop: 4,
                          color: "var(--text-3)",
                        }}
                      >
                        {t("add_image_hint")}
                      </div>
                    </div>
                  </div>
                )}
              </label>

              {/* Start button */}
              <button
                onClick={startCycle}
                disabled={phase === "running"}
                style={{
                  padding: "14px 0",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: phase === "running" ? "not-allowed" : "pointer",
                  background:
                    phase === "running"
                      ? "rgba(74,222,128,0.1)"
                      : phase === "done"
                        ? "rgba(74,222,128,0.15)"
                        : "var(--green)",
                  border:
                    phase === "running" || phase === "done"
                      ? "1px solid rgba(74,222,128,0.4)"
                      : "none",
                  color:
                    phase === "running" || phase === "done"
                      ? "var(--green)"
                      : "var(--btn-on-green)",
                  opacity: phase === "running" ? 0.8 : 1,
                  transition: "all 0.2s",
                  boxShadow:
                    phase === "idle" ? "0 0 20px rgba(74,222,128,0.2)" : "none",
                }}
              >
                {phase === "running" ? (
                  <>
                    <Activity size={15} className="animate-spin" />{" "}
                    {t("add_running")}
                  </>
                ) : phase === "done" ? (
                  <>
                    <CheckCircle2 size={15} /> {t("add_run_another")}
                  </>
                ) : (
                  <>
                    <Play size={15} fill="currentColor" /> {t("add_start")}
                  </>
                )}
              </button>
            </div>

            {/* Sensor inputs */}
            <div
              style={{
                borderRadius: 16,
                padding: 22,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="section-label">{t("add_sensor_params")}</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                {INPUT_FIELDS.map(
                  ({
                    label,
                    name,
                    icon: Icon,
                    color,
                    type,
                    opts,
                    placeholder,
                    step,
                    min,
                    max,
                    hint,
                  }) => (
                    <div key={name}>
                      <div
                        className="sensor-label"
                        style={{ color, marginBottom: 3 }}
                      >
                        {label.toUpperCase()}
                      </div>
                      {hint && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-3)",
                            marginBottom: 5,
                            lineHeight: 1.4,
                          }}
                        >
                          {hint}
                        </div>
                      )}
                      <div style={{ position: "relative" }}>
                        <Icon
                          size={12}
                          style={{
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color,
                            zIndex: 1,
                          }}
                        />
                        {type === "select" ? (
                          <>
                            <select
                              value={sensors[name]}
                              onChange={(e) =>
                                setSensors({
                                  ...sensors,
                                  [name]: e.target.value,
                                })
                              }
                              disabled={phase === "running"}
                              style={{
                                width: "100%",
                                appearance: "none",
                                paddingLeft: 30,
                                paddingRight: 28,
                                paddingTop: 9,
                                paddingBottom: 9,
                                borderRadius: 8,
                                fontSize: 13,
                                fontFamily: "DM Mono, monospace",
                                background: "var(--bg-3)",
                                border: "1px solid var(--border)",
                                color: "var(--text)",
                                outline: "none",
                                cursor: "pointer",
                                opacity: phase === "running" ? 0.7 : 1,
                              }}
                            >
                              {opts.map((o) => (
                                <option key={o} value={o}>
                                  {td(o)}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              size={10}
                              style={{
                                position: "absolute",
                                right: 10,
                                top: "50%",
                                transform: "translateY(-50%)",
                                pointerEvents: "none",
                                color: "var(--text-3)",
                              }}
                            />
                          </>
                        ) : (
                          <input
                            value={sensors[name]}
                            onChange={(e) =>
                              setSensors({ ...sensors, [name]: e.target.value })
                            }
                            type={type}
                            placeholder={placeholder || ""}
                            step={step}
                            min={min}
                            max={max}
                            disabled={phase === "running"}
                            style={{
                              width: "100%",
                              paddingLeft: 30,
                              paddingRight: 10,
                              paddingTop: 9,
                              paddingBottom: 9,
                              borderRadius: 8,
                              fontSize: 13,
                              fontFamily: "DM Mono, monospace",
                              background: "var(--bg-3)",
                              border: "1px solid var(--border)",
                              color: "var(--text)",
                              outline: "none",
                              boxSizing: "border-box",
                              opacity: phase === "running" ? 0.7 : 1,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          {/* Live agent log */}
          {(phase !== "idle" || logs.length > 0) && (
            <div
              className="animate-fade-up"
              style={{
                borderRadius: 16,
                overflow: "hidden",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              {/* Log header */}
              <div
                style={{
                  padding: "12px 18px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {phase === "running" ? (
                    <span
                      className="alert-pulse"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--green)",
                        flexShrink: 0,
                      }}
                    />
                  ) : phase === "done" ? (
                    <CheckCircle2 size={14} style={{ color: "var(--green)" }} />
                  ) : (
                    <AlertTriangle size={14} style={{ color: "var(--red)" }} />
                  )}
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--text)",
                      fontFamily: "DM Mono, monospace",
                    }}
                  >
                    {phase === "running"
                      ? t("add_log_live")
                      : phase === "done"
                        ? t("add_log_done")
                        : t("add_log_idle")}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--text-3)",
                  }}
                >
                  {t("add_log_lines", { n: logs.length })}
                </span>

                {/* Agent legend */}
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {Object.entries(AGENT_META)
                    .filter(([k]) => logs.some((l) => l.agent === k))
                    .map(([k, v]) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 9,
                          fontFamily: "DM Mono, monospace",
                          padding: "2px 7px",
                          borderRadius: 4,
                          background: v.bg,
                          color: v.color,
                          border: `1px solid ${v.color}30`,
                        }}
                      >
                        {td(v.label)}
                      </span>
                    ))}
                </div>
              </div>

              {/* Log body */}
              <div
                className="log-area"
                style={{
                  padding: "12px 18px",
                  maxHeight: 340,
                  overflowY: "auto",
                  fontFamily: "DM Mono, monospace",
                }}
              >
                {logs.map((entry, i) => (
                  <LogLine key={i} entry={entry} idx={i} td={td} />
                ))}
                {phase === "running" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 0",
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "DM Mono, monospace",
                        color: "var(--green)",
                      }}
                      className="cursor-blink"
                    >
                      {" "}
                    </span>
                  </div>
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Final action cards */}
          {finalAction && phase === "done" && (
            <div
              className="animate-fade-up"
              style={{
                borderRadius: 16,
                overflow: "hidden",
                background: "var(--surface)",
                border: "1px solid rgba(74,222,128,0.3)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  padding: "12px 18px",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(74,222,128,0.05)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CheckCircle2 size={14} style={{ color: "var(--green)" }} />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--text)",
                  }}
                >
                  {t("add_actuator_dispatched")}
                </span>
              </div>
              <div
                style={{
                  padding: "18px 20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 12,
                }}
              >
                {[
                  {
                    key: "acid_dosage_ml",
                    labelKey: "widget_acid",
                    unit: "ml",
                    icon: FlaskConical,
                    color: "var(--red)",
                  },
                  {
                    key: "base_dosage_ml",
                    labelKey: "widget_base",
                    unit: "ml",
                    icon: FlaskConical,
                    color: "#a78bfa",
                  },
                  {
                    key: "nutrient_dosage_ml",
                    labelKey: "widget_nutrients",
                    unit: "ml",
                    icon: Sprout,
                    color: "var(--green)",
                  },
                  {
                    key: "fan_speed_pct",
                    labelKey: "widget_fan",
                    unit: "%",
                    icon: Fan,
                    color: "var(--blue)",
                  },
                  {
                    key: "water_refill_l",
                    labelKey: "widget_water",
                    unit: "L",
                    icon: Waves,
                    color: "#22d3ee",
                  },
                ].map(({ key, labelKey, unit, icon: Icon, color }) => {
                  const val = finalAction[key] ?? 0;
                  const active = parseFloat(val) > 0;
                  return (
                    <div
                      key={key}
                      style={{
                        borderRadius: 12,
                        padding: "14px 10px",
                        textAlign: "center",
                        background: active ? `${color}12` : "var(--bg-3)",
                        border: `1px solid ${active ? color + "40" : "var(--border)"}`,
                        transition: "all 0.3s",
                      }}
                    >
                      <Icon
                        size={16}
                        style={{
                          color: active ? color : "var(--text-3)",
                          margin: "0 auto 6px",
                        }}
                      />
                      <div
                        style={{
                          fontWeight: 700,
                          fontFamily: "DM Mono, monospace",
                          fontSize: 22,
                          color: active ? color : "var(--text-3)",
                          lineHeight: 1,
                        }}
                      >
                        {val}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: "DM Mono, monospace",
                          color: "var(--text-3)",
                          marginTop: 2,
                        }}
                      >
                        {unit}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: active ? "var(--text-2)" : "var(--text-3)",
                          marginTop: 4,
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {t(labelKey)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "0 20px 16px", display: "flex", gap: 10 }}>
                <button
                  onClick={() => navigate("/dashboard")}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    background: "var(--green)",
                    border: "none",
                    color: "var(--btn-on-green)",
                    cursor: "pointer",
                  }}
                >
                  {t("add_view_dashboard")}
                </button>
                <button
                  onClick={startCycle}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-2)",
                    cursor: "pointer",
                  }}
                >
                  {t("add_run_next")}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
