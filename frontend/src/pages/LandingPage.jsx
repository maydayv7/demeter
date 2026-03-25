import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf,
  ArrowRight,
  Cpu,
  Database,
  Eye,
  Zap,
  Activity,
  Sparkles,
} from "lucide-react";
import { useFarmData } from "../hooks/useFarmData";
import { extractSensors, deriveCropStatus } from "../utils/dataUtils";
import { useT } from "../hooks/useTranslation";

function computeFleetStats(dashData) {
  if (!dashData?.length) return null;
  const sensors = dashData.map((d) => extractSensors(d.payload));
  const avg = (arr) =>
    arr.reduce((s, v) => s + parseFloat(v || 0), 0) / arr.length;

  const ph = avg(sensors.map((s) => s.ph));
  const ec = avg(sensors.map((s) => s.ec));
  const temp = avg(sensors.map((s) => s.temp));
  const humidity = avg(sensors.map((s) => s.humidity));

  const totalSeqs = dashData.reduce(
    (s, d) => s + (d.payload?.sequence_number || 0),
    0,
  );
  const cropTypes = [
    ...new Set(dashData.map((d) => d.payload?.crop).filter(Boolean)),
  ];

  const alerts = dashData.filter((d) => {
    const status = deriveCropStatus(d.payload);
    return status === "Critical" || status === "Attention";
  }).length;

  return {
    ph: ph.toFixed(2),
    ec: ec.toFixed(2),
    temp: temp.toFixed(1),
    humidity: humidity.toFixed(1),
    cropCount: dashData.length,
    totalSeqs,
    cropTypes,
    alerts,
  };
}

function buildActivityLog(historyData) {
  if (!historyData?.length) return [];
  return historyData
    .slice(-5)
    .reverse()
    .map((d, i) => {
      const p = d.payload || {};
      const agent = (p.strategic_intent || "SUPERVISOR")
        .replace(/_/g, " ")
        .split(" ")[0];
      const msg = p.strategic_intent
        ? `Strategy: ${p.strategic_intent.replace(/_/g, " ")}`
        : `Monitoring ${p.crop || "crop"} — seq #${p.sequence_number || 1}`;
      const ts = p.timestamp
        ? new Date(p.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : `0${i}:0${i}`;
      return { agent, msg, time: ts };
    });
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, td } = useT();
  const [mounted, setMounted] = useState(false);
  const { dashboard, history, loading } = useFarmData();

  const [stats, setStats] = useState(null);
  const [log, setLog] = useState([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading) {
      setStats(computeFleetStats(dashboard));
      setLog(buildActivityLog(history));
    }
  }, [dashboard, history, loading]);

  const FEATURES = [
    {
      icon: Cpu,
      label: t("landing_feature_rl"),
      desc: t("landing_feature_rl_desc"),
    },
    {
      icon: Eye,
      label: t("landing_feature_cv"),
      desc: t("landing_feature_cv_desc"),
    },
    {
      icon: Database,
      label: t("landing_feature_vector"),
      desc: t("landing_feature_vector_desc"),
    },
    {
      icon: Zap,
      label: t("landing_feature_sim"),
      desc: t("landing_feature_sim_desc"),
    },
  ];

  const headlineStats = stats
    ? [
        { val: stats.cropCount.toString(), label: t("landing_active_crops") },
        {
          val: stats.cropTypes.length.toString(),
          label: t("landing_crop_types"),
        },
        { val: stats.totalSeqs.toString(), label: t("landing_total_cycles") },
        {
          val: stats.alerts > 0 ? stats.alerts.toString() : "0",
          label: t("landing_active_alerts"),
        },
      ]
    : [
        { val: "—", label: t("landing_active_crops") },
        { val: "—", label: t("landing_crop_types") },
        { val: "—", label: t("landing_total_cycles") },
        { val: "—", label: t("landing_active_alerts") },
      ];

  // Live sensor readings
  const readings = stats
    ? [
        {
          label: t("analytics_avg_ph"),
          value: stats.ph,
          ok: parseFloat(stats.ph) >= 5.5 && parseFloat(stats.ph) <= 6.5,
        },
        {
          label: t("analytics_avg_ec"),
          value: `${stats.ec}`,
          ok: parseFloat(stats.ec) <= 2.5,
        },
        {
          label: t("sensor_temp").toUpperCase(),
          value: `${stats.temp}°C`,
          ok: parseFloat(stats.temp) >= 18 && parseFloat(stats.temp) <= 30,
        },
        {
          label: t("sensor_humidity").toUpperCase(),
          value: `${stats.humidity}%`,
          ok:
            parseFloat(stats.humidity) >= 40 &&
            parseFloat(stats.humidity) <= 80,
        },
      ]
    : [
        { label: t("analytics_avg_ph"), value: "—", ok: true },
        { label: t("analytics_avg_ec"), value: "—", ok: true },
        { label: t("sensor_temp").toUpperCase(), value: "—", ok: true },
        { label: t("sensor_humidity").toUpperCase(), value: "—", ok: true },
      ];

  return (
    <div
      className="min-h-screen grid-bg relative overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <div className="scanline" />

      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(74,222,128,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Nav */}
      <nav
        className="relative z-10 flex items-center justify-between px-8 py-5 border-b"
        style={{ borderColor: "rgba(74,222,128,0.1)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1a5c2d, #4ade80)" }}
          >
            <Leaf size={18} fill="white" color="white" />
          </div>
          <div>
            <div
              className="font-bold text-base tracking-tight"
              style={{ color: "var(--text)" }}
            >
              DEMETER
            </div>
            <div
              className="text-[9px] font-mono tracking-[0.2em]"
              style={{ color: "var(--text-3)" }}
            >
              {td("AUTONOMOUS FARM INTELLIGENCE")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded-full"
            style={{
              border: "1px solid rgba(74,222,128,0.3)",
              color: "var(--green)",
              background: "rgba(74,222,128,0.05)",
            }}
          >
            <span
              className="status-dot w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--green)" }}
            />
            {loading
              ? t("sidebar_connecting")
              : stats
                ? t("sidebar_farm_online")
                : t("sidebar_no_data")}
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "var(--surface)",
              color: "var(--text-2)",
              border: "1px solid var(--border)",
            }}
          >
            {t("landing_enter_dash")}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div
            className={`space-y-8 ${mounted ? "animate-fade-up" : "opacity-0"}`}
          >
            <div
              className="inline-flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded-full"
              style={{
                border: "1px solid rgba(245,158,11,0.4)",
                color: "var(--amber)",
                background: "rgba(245,158,11,0.06)",
              }}
            >
              <Zap size={10} fill="currentColor" />
              {td("MULTI-AGENT SYSTEM · LANGGRAPH · AZURE")}
            </div>

            <h1
              className="text-6xl lg:text-7xl font-bold leading-[1.0] tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {t("landing_hero_1")}
              <br />
              <span
                className="font-serif italic"
                style={{ color: "var(--green)" }}
              >
                {t("landing_hero_2")}
              </span>
              <br />
              {t("landing_hero_3")}
            </h1>

            <p
              className="text-lg leading-relaxed max-w-md"
              style={{ color: "var(--text-2)", fontWeight: 300 }}
            >
              {t("landing_hero_sub")}
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="group flex items-center gap-3 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all glow-green"
                style={{ background: "var(--green)", color: "#0c1a0e" }}
              >
                {t("landing_enter_dash")}{" "}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
              <button
                onClick={() => navigate("/intelligence")}
                className="flex items-center gap-3 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-2)",
                  background: "var(--surface)",
                }}
              >
                <Sparkles size={16} /> {t("landing_intelligence")}
              </button>
            </div>

            {/* Live headline stats from DB */}
            <div
              className="grid grid-cols-4 gap-4 pt-4 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              {headlineStats.map(({ val, label }) => (
                <div key={label}>
                  <div
                    className="text-2xl font-bold font-mono"
                    style={{ color: "var(--green)" }}
                  >
                    {loading ? (
                      <span className="inline-block w-8 h-6 rounded shimmer" />
                    ) : (
                      val
                    )}
                  </div>
                  <div
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-3)" }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live HUD */}
          <div
            className={`relative ${mounted ? "animate-fade-in" : "opacity-0"}`}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "1px solid var(--border)",
                background: "var(--bg-2)",
              }}
            >
              {/* Terminal header */}
              <div
                className="flex items-center gap-2 px-4 py-3 border-b"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-3)",
                }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: "#ff5f57" }}
                />
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: "#ffbd2e" }}
                />
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: "#28ca41" }}
                />
                <span
                  className="ml-2 text-[11px] font-mono"
                  style={{ color: "var(--text-3)" }}
                >
                  {t("landing_live_feed")}
                </span>
                <Activity
                  size={11}
                  className="ml-auto"
                  style={{ color: "var(--green)" }}
                />
              </div>

              <div className="p-6 space-y-5">
                {/* Live sensor grid */}
                <div className="grid grid-cols-2 gap-3">
                  {readings.map(({ label, value, ok }) => (
                    <div
                      key={label}
                      className="rounded-xl p-4"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="text-[10px] font-mono mb-2"
                        style={{ color: "var(--text-3)" }}
                      >
                        {label}
                      </div>
                      {loading ? (
                        <div className="h-7 w-16 rounded shimmer" />
                      ) : (
                        <div
                          className="text-2xl font-mono font-bold"
                          style={{ color: ok ? "var(--green)" : "var(--red)" }}
                        >
                          {value}
                        </div>
                      )}
                      <div
                        className="text-[9px] font-mono mt-1"
                        style={{
                          color: ok
                            ? "rgba(74,222,128,0.6)"
                            : "rgba(248,113,113,0.6)",
                        }}
                      >
                        {ok ? t("landing_optimal") : t("landing_alert")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agent activity feed */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="text-[10px] font-mono mb-3"
                    style={{ color: "var(--text-3)" }}
                  >
                    {t("landing_recent_activity")}
                  </div>
                  <div className="space-y-2">
                    {loading ? (
                      [1, 2, 3].map((i) => (
                        <div key={i} className="h-4 rounded shimmer" />
                      ))
                    ) : log.length > 0 ? (
                      log.slice(0, 3).map(({ agent, msg, time }, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-[11px] font-mono"
                        >
                          <span style={{ color: "var(--green)", opacity: 0.6 }}>
                            {time}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px]"
                            style={{
                              background: "rgba(74,222,128,0.12)",
                              color: "var(--green)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {td(agent.substring(0, 12))}
                          </span>
                          <span style={{ color: "var(--text-2)" }}>
                            {td(msg.substring(0, 40))}
                            {msg.length > 40 ? "…" : ""}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        className="text-[11px] font-mono"
                        style={{ color: "var(--text-3)" }}
                      >
                        {t("landing_no_cycles")}
                      </div>
                    )}
                    <div
                      className="flex items-center gap-1 text-[11px] font-mono cursor-blink"
                      style={{ color: "var(--green)" }}
                    >
                      <span style={{ opacity: 0.4 }}>→ </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live crop count chip */}
            {stats && (
              <div
                className="absolute -top-4 -right-4 px-3 py-2 rounded-lg text-[11px] font-mono"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--amber)",
                }}
              >
                ⬆ {stats.cropCount} {t("common_crop").toLowerCase()}
                {stats.cropCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* Feature grid */}
        <div
          className="mt-24 pt-12 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="text-[11px] font-mono mb-8"
            style={{ color: "var(--text-3)" }}
          >
            {t("landing_capabilities")}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="p-5 rounded-xl card-hover"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                  style={{
                    background: "rgba(74,222,128,0.1)",
                    border: "1px solid rgba(74,222,128,0.2)",
                  }}
                >
                  <Icon size={18} style={{ color: "var(--green)" }} />
                </div>
                <div
                  className="font-semibold text-sm mb-1"
                  style={{ color: "var(--text)" }}
                >
                  {label}
                </div>
                <div
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-3)" }}
                >
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
