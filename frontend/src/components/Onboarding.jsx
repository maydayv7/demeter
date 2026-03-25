import React, { useState } from "react";
import {
  Leaf,
  LayoutGrid,
  PlusCircle,
  Bell,
  ChevronRight,
  X,
  CheckCircle2,
} from "lucide-react";
import { useSettings } from "../hooks/useSettings";
import { useT } from "../hooks/useTranslation";

const STEP_ICONS = [Leaf, LayoutGrid, PlusCircle, Bell, CheckCircle2];
const STEP_COLORS = [
  "var(--green)",
  "var(--blue)",
  "var(--green)",
  "var(--red)",
  "#f59e0b",
];
const STEP_KEYS = [
  { title: "onboarding_s1_title", desc: "onboarding_s1_desc" },
  { title: "onboarding_s2_title", desc: "onboarding_s2_desc" },
  { title: "onboarding_s3_title", desc: "onboarding_s3_desc" },
  { title: "onboarding_s4_title", desc: "onboarding_s4_desc" },
  { title: "onboarding_s5_title", desc: "onboarding_s5_desc" },
];

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const { update } = useSettings();
  const { t } = useT();

  const total = STEP_KEYS.length;
  const isLast = step === total - 1;
  const Icon = STEP_ICONS[step];
  const color = STEP_COLORS[step];
  const { title: titleKey, desc: descKey } = STEP_KEYS[step];

  const finish = () => {
    update("onboardingDone", true);
    onDone?.();
  };

  return (
    /* Backdrop */
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Modal */}
      <div
        className="animate-fade-up"
        style={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 20,
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header strip */}
        <div
          style={{
            height: 4,
            background: "var(--border)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${((step + 1) / total) * 100}%`,
              background: color,
              borderRadius: 4,
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {/* Top row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 0",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
            }}
          >
            {t("onboarding_step", { n: step + 1, total })}
          </span>
          <button
            onClick={finish}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-3)",
              display: "flex",
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "24px 28px 28px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `${color}18`,
              border: `1px solid ${color}35`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={26} style={{ color }} />
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text)",
              lineHeight: 1.2,
            }}
          >
            {t(titleKey)}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 14,
              color: "var(--text-2)",
              lineHeight: 1.75,
              whiteSpace: "pre-line",
            }}
          >
            {t(descKey)}
          </div>

          {/* Step dots */}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 4,
              alignSelf: "center",
            }}
          >
            {STEP_KEYS.map((_, i) => (
              <div
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  background: i === step ? color : "var(--border)",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: 10,
              width: "100%",
              marginTop: 4,
            }}
          >
            <button
              onClick={finish}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              {t("onboarding_skip")}
            </button>
            <button
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              style={{
                flex: 2,
                padding: "10px 0",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                background: color,
                border: "none",
                color: isLast ? "#0c1a0e" : "#0c1a0e",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {isLast ? t("onboarding_finish") : t("onboarding_next")}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
