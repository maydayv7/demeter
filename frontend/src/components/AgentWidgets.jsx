import { Fan, FlaskConical, Sprout, Waves } from "lucide-react";

// Shared action metadata
const ACTION_META = {
  acid_dosage_ml: {
    label: "Acid Dosage",
    icon: FlaskConical,
    unit: "ml",
    color: "var(--red)",
    bg: "rgba(248,113,113,0.1)",
    desc: "pH Down",
  },
  base_dosage_ml: {
    label: "Base Dosage",
    icon: FlaskConical,
    unit: "ml",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.1)",
    desc: "pH Up",
  },
  nutrient_dosage_ml: {
    label: "Nutrients",
    icon: Sprout,
    unit: "ml",
    color: "var(--green)",
    bg: "rgba(74,222,128,0.1)",
    desc: "EC Boost",
  },
  fan_speed_pct: {
    label: "Fan Speed",
    icon: Fan,
    unit: "%",
    color: "var(--blue)",
    bg: "rgba(96,165,250,0.1)",
    desc: "Airflow",
  },
  water_refill_l: {
    label: "Water Refill",
    icon: Waves,
    unit: "L",
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.1)",
    desc: "Dilution",
  },
};

// Parse action JSON safely
function parseAction(raw) {
  if (!raw || raw === "PENDING_ACTION") return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(
        raw
          .replace(/'/g, '"')
          .replace(/\bNone\b/g, "null")
          .replace(/\bTrue\b/g, "true")
          .replace(/\bFalse\b/g, "false"),
      );
    } catch {
      return null;
    }
  }
}

// Show actuator commands as cards
export function AgentActionWidget({ actionTaken, compact = false }) {
  const action = parseAction(actionTaken);
  if (!action) return null;

  const entries = Object.entries(ACTION_META).map(([key, meta]) => ({
    key,
    meta,
    value: action[key] ?? 0,
  }));

  const active = entries.filter((e) => parseFloat(e.value) > 0);
  const display = active.length > 0 ? active : entries;

  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {display.map(({ key, meta, value }) => {
          const Icon = meta.icon;
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 20,
                background: meta.bg,
                border: `1px solid ${meta.color}40`,
              }}
            >
              <Icon size={11} style={{ color: meta.color }} />
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  color: meta.color,
                  fontWeight: 600,
                }}
              >
                {value}
                {meta.unit}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                }}
              >
                {meta.desc}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        gap: 10,
      }}
    >
      {entries.map(({ key, meta, value }) => {
        const Icon = meta.icon;
        const isActive = parseFloat(value) > 0;
        return (
          <div
            key={key}
            style={{
              borderRadius: 12,
              padding: "14px 12px",
              textAlign: "center",
              background: isActive ? meta.bg : "var(--bg-3)",
              border: `1px solid ${isActive ? meta.color + "40" : "var(--border)"}`,
              transition: "all 0.2s",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isActive ? meta.bg : "var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px",
              }}
            >
              <Icon
                size={14}
                style={{ color: isActive ? meta.color : "var(--text-3)" }}
              />
            </div>
            <div
              style={{
                fontWeight: 700,
                fontFamily: "DM Mono, monospace",
                fontSize: 22,
                color: isActive ? meta.color : "var(--text-3)",
                lineHeight: 1,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
                marginTop: 2,
              }}
            >
              {meta.unit}
            </div>
            <div
              style={{
                fontSize: 11,
                color: isActive ? "var(--text-2)" : "var(--text-3)",
                marginTop: 4,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {meta.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Agent Outcome
export function AgentOutcomeWidget({ outcome, rewardScore, strategicIntent }) {
  if (!outcome || outcome === "PENDING_OBSERVATION") return null;

  const raw = outcome.split("| Reward:")[0].trim();
  const reward =
    rewardScore != null
      ? parseFloat(rewardScore)
      : outcome.includes("Reward:")
        ? parseFloat(outcome.split("Reward:")[1])
        : null;

  const isPositive = raw === "IMPROVED" || (reward != null && reward > 0.3);
  const isNegative =
    raw === "DETERIORATED" || (reward != null && reward < -0.1);

  const color = isNegative
    ? "var(--red)"
    : isPositive
      ? "var(--green)"
      : "var(--amber)";
  const bg = isNegative
    ? "rgba(248,113,113,0.08)"
    : isPositive
      ? "rgba(74,222,128,0.08)"
      : "rgba(245,158,11,0.08)";
  const border = isNegative
    ? "rgba(248,113,113,0.25)"
    : isPositive
      ? "rgba(74,222,128,0.25)"
      : "rgba(245,158,11,0.25)";

  const emoji = isNegative ? "▼" : isPositive ? "▲" : "●";

  return (
    <div
      style={{
        borderRadius: 12,
        padding: "12px 16px",
        background: bg,
        border: `1px solid ${border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 18,
          fontFamily: "DM Mono, monospace",
          color,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {emoji} {raw}
      </span>

      {reward != null && (
        <span
          style={{
            fontSize: 13,
            fontFamily: "DM Mono, monospace",
            padding: "2px 10px",
            borderRadius: 20,
            background: `${color}20`,
            color,
            border: `1px solid ${color}40`,
            flexShrink: 0,
          }}
        >
          Reward: {reward > 0 ? "+" : ""}
          {reward.toFixed(2)}
        </span>
      )}

      {strategicIntent && (
        <span
          style={{
            fontSize: 11,
            fontFamily: "DM Mono, monospace",
            padding: "2px 10px",
            borderRadius: 20,
            background: "var(--bg-3)",
            color: "var(--text-3)",
            border: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {strategicIntent.replace(/_/g, " ")}
        </span>
      )}
    </div>
  );
}
