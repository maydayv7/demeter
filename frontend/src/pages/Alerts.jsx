import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
  X,
  Bell,
  BellOff,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  Scissors,
} from "lucide-react";
import { useFarmData } from "../hooks/useFarmData";
import { generateAlerts } from "../utils/dataUtils";
import Sidebar from "../components/Sidebar";
import { useT } from "../hooks/useTranslation";

// Severity
const SEV = {
  critical: {
    icon: AlertTriangle,
    bg: "rgba(248,113,113,0.1)",
    border: "rgba(248,113,113,0.3)",
    text: "var(--red)",
    labelKey: "alerts_severity_critical",
  },
  warning: {
    icon: Zap,
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    text: "var(--amber)",
    labelKey: "alerts_severity_warning",
  },
  info: {
    icon: Info,
    bg: "rgba(96,165,250,0.1)",
    border: "rgba(96,165,250,0.25)",
    text: "var(--blue)",
    labelKey: "alerts_severity_info",
  },
};

const HARVEST_STYLE = {
  icon: Scissors,
  bg: "rgba(245,158,11,0.12)",
  border: "rgba(245,158,11,0.35)",
  text: "var(--amber)",
  labelKey: "alerts_severity_harvest",
};

const AGENT_COLORS = {
  WATER: "var(--blue)",
  ATMOSPHERIC: "#a78bfa",
  SUPERVISOR: "var(--green)",
  JUDGE: "var(--amber)",
  DOCTOR: "var(--red)",
  HISTORIAN: "var(--text-3)",
};

function AlertCard({ alert, onAck, onDismiss, t, td }) {
  const style = alert.isHarvestAlert ? HARVEST_STYLE : SEV[alert.severity];
  const Icon = style.icon;

  return (
    <div
      className="card-hover"
      style={{
        borderRadius: 12,
        padding: 16,
        background: alert.ack ? "var(--surface)" : style.bg,
        border: `1px solid ${alert.ack ? "var(--border)" : style.border}`,
        opacity: alert.ack ? 0.55 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: style.bg,
            border: `1px solid ${style.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <Icon size={14} style={{ color: style.text }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: alert.ack ? "var(--text-2)" : "var(--text)",
              }}
            >
              {alert.title}
            </span>
            <span
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                padding: "2px 6px",
                borderRadius: 4,
                background: style.bg,
                color: style.text,
                border: `1px solid ${style.border}`,
              }}
            >
              {t(style.labelKey)}
            </span>
            <span
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                padding: "2px 6px",
                borderRadius: 4,
                background: "var(--bg-3)",
                color: AGENT_COLORS[alert.agent] || "var(--text-3)",
                border: "1px solid var(--border)",
              }}
            >
              {td(alert.agent)}
            </span>
          </div>

          <p
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              margin: "4px 0 8px",
              lineHeight: 1.5,
            }}
          >
            {td(alert.desc)}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
              }}
            >
              <Clock size={9} /> {alert.time}
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
              }}
            >
              {t("alerts_crop_label", { crop: td(alert.crop) })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {!alert.ack && (
            <button
              onClick={() => onAck(alert.id)}
              title="Acknowledge"
              style={{
                width: 28,
                height: 28,
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
              <CheckCircle2 size={13} />
            </button>
          )}
          <button
            onClick={() => onDismiss(alert.id)}
            title="Dismiss"
            style={{
              width: 28,
              height: 28,
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
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// MAIN

export default function Alerts() {
  const { history, loading, refreshData } = useFarmData();
  const { t, td } = useT();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showAcked, setShowAcked] = useState(false);

  useEffect(() => {
    if (!loading) setAlerts(generateAlerts(history, t));
  }, [history, loading, t]);

  const ack = (id) =>
    setAlerts((a) => a.map((al) => (al.id === id ? { ...al, ack: true } : al)));
  const dismiss = (id) => setAlerts((a) => a.filter((al) => al.id !== id));
  const ackAll = () => setAlerts((a) => a.map((al) => ({ ...al, ack: true })));

  const counts = useMemo(
    () => ({
      harvest: alerts.filter((a) => a.isHarvestAlert && !a.ack).length,
      critical: alerts.filter(
        (a) => a.severity === "critical" && !a.ack && !a.isHarvestAlert,
      ).length,
      warning: alerts.filter((a) => a.severity === "warning" && !a.ack).length,
      info: alerts.filter(
        (a) => a.severity === "info" && !a.ack && !a.isHarvestAlert,
      ).length,
      total: alerts.filter((a) => !a.ack).length,
    }),
    [alerts],
  );

  const filtered = useMemo(
    () =>
      alerts.filter((a) => {
        if (!showAcked && a.ack) return false;
        if (filter === "harvest") return a.isHarvestAlert;
        if (filter !== "all" && a.severity !== filter) return false;
        return true;
      }),
    [alerts, filter, showAcked],
  );

  // Filters
  const FILTER_OPTIONS = [
    { key: "all", label: t("common_all"), count: alerts.length, color: null },
    {
      key: "harvest",
      label: t("alerts_filter_harvest"),
      count: counts.harvest,
      color: "var(--amber)",
    },
    {
      key: "critical",
      label: t("dash_critical"),
      count: counts.critical,
      color: "var(--red)",
    },
    {
      key: "warning",
      label: t("alerts_filter_warning"),
      count: counts.warning,
      color: "var(--amber)",
    },
    {
      key: "info",
      label: t("alerts_filter_info"),
      count: counts.info,
      color: "var(--blue)",
    },
  ];

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
          <div>
            <h1 className="page-title">{t("alerts_title")}</h1>
            <p className="page-subtitle">
              {loading
                ? t("alerts_subtitle_loading")
                : t("alerts_subtitle", {
                    unacked: counts.total,
                    total: alerts.length,
                  })}
            </p>
          </div>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button
              onClick={refreshData}
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
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => setShowAcked(!showAcked)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 11,
                fontFamily: "DM Mono, monospace",
                background: showAcked
                  ? "rgba(74,222,128,0.1)"
                  : "var(--surface)",
                border: `1px solid ${showAcked ? "rgba(74,222,128,0.3)" : "var(--border)"}`,
                color: showAcked ? "var(--green)" : "var(--text-3)",
                cursor: "pointer",
              }}
            >
              {showAcked ? <Bell size={12} /> : <BellOff size={12} />}
              {showAcked ? t("alerts_show_all") : t("alerts_unacked_only")}
            </button>

            <button
              onClick={ackAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 11,
                fontFamily: "DM Mono, monospace",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              <CheckCircle2 size={12} /> {t("alerts_ack_all")}
            </button>
          </div>
        </header>

        {/* Filter bar */}
        <div
          style={{
            flexShrink: 0,
            padding: "8px 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflowX: "auto",
          }}
        >
          <SlidersHorizontal
            size={14}
            style={{ color: "var(--text-3)", flexShrink: 0 }}
          />
          {FILTER_OPTIONS.map(({ key, label, count, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontFamily: "DM Mono, monospace",
                flexShrink: 0,
                cursor: "pointer",
                background: filter === key ? "var(--surface)" : "transparent",
                border: `1px solid ${filter === key ? "var(--border-bright)" : "transparent"}`,
                color:
                  filter === key ? color || "var(--text)" : "var(--text-3)",
                transition: "all 0.15s",
              }}
            >
              {count > 0 && (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    background: color ? `${color}30` : "var(--border)",
                    color: color || "var(--text-3)",
                  }}
                >
                  {count}
                </span>
              )}
              {label}
            </button>
          ))}
        </div>

        {/* Alert list */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div
              style={{
                maxWidth: 640,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="shimmer"
                  style={{
                    height: 80,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                  }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 size={24} style={{ color: "var(--green)" }} />
              </div>
              <div style={{ color: "var(--text-2)" }}>
                {alerts.length === 0
                  ? t("alerts_empty_nodata")
                  : t("alerts_empty_connected")}
              </div>
            </div>
          ) : (
            <div
              style={{
                maxWidth: 640,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {/* Unacked */}
              {filtered.filter((a) => !a.ack).length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "DM Mono, monospace",
                      color: "var(--text-3)",
                      marginBottom: 12,
                    }}
                  >
                    {t("alerts_unacked", {
                      n: filtered.filter((a) => !a.ack).length,
                    })}
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {filtered
                      .filter((a) => !a.ack)
                      .map((a) => (
                        <AlertCard
                          key={a.id}
                          alert={a}
                          onAck={ack}
                          onDismiss={dismiss}
                          t={t}
                          td={td}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Acked */}
              {showAcked && filtered.filter((a) => a.ack).length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "DM Mono, monospace",
                      color: "var(--text-3)",
                      marginBottom: 12,
                    }}
                  >
                    {t("alerts_acknowledged", {
                      n: filtered.filter((a) => a.ack).length,
                    })}
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {filtered
                      .filter((a) => a.ack)
                      .map((a) => (
                        <AlertCard
                          key={a.id}
                          alert={a}
                          onAck={ack}
                          onDismiss={dismiss}
                          t={t}
                          td={td}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
