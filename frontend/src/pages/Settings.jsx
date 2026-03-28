import { useState } from "react";
import {
  User,
  Sun,
  Moon,
  Monitor,
  Save,
  RotateCcw,
  Check,
  Database,
  Bell,
  LayoutGrid,
  Zap,
  Globe,
  HelpCircle,
} from "lucide-react";
import { PageShell, PageHeader, SectionCard } from "../components/ui";
import { useSettings } from "../hooks/useSettings";
import { useT } from "../hooks/useTranslation";
import { USE_MOCK_DATA } from "../data/mockData";
import Onboarding from "../components/Onboarding";

function SectionHeader({ icon: Icon, title, sub }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "rgba(74,222,128,0.1)",
          border: "1px solid rgba(74,222,128,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} style={{ color: "var(--green)" }} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
          {title}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>
        {label}
      </label>
      {hint && (
        <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "DM Mono, monospace",
  background: "var(--bg-3)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};

function Toggle({ value, onChange, enabledLabel, disabledLabel }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        marginTop: 6,
      }}
    >
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: value ? "var(--green)" : "var(--border)",
          position: "relative",
          cursor: "pointer",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 3,
            left: value ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.2s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        />
      </div>
      <span style={{ fontSize: 13, color: "var(--text-2)" }}>
        {value ? enabledLabel : disabledLabel}
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { t } = useT();
  const [saved, setSaved] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [draft, setDraft] = useState({ ...settings });
  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  const handleSave = () => {
    Object.entries(draft).forEach(([k, v]) => update(k, v));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    reset();
    setDraft({ ...settings });
  };

  const ThemeButton = ({ value, label, Icon }) => (
    <button
      onClick={() => set("theme", value)}
      style={{
        flex: 1,
        padding: "12px 0",
        borderRadius: 12,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        background:
          draft.theme === value ? "rgba(74,222,128,0.12)" : "var(--bg-3)",
        border: `2px solid ${draft.theme === value ? "var(--green)" : "var(--border)"}`,
        color: draft.theme === value ? "var(--green)" : "var(--text-3)",
        transition: "all 0.15s",
      }}
    >
      <Icon size={18} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
    </button>
  );

  const LangButton = ({ value, label }) => (
    <button
      onClick={() => set("language", value)}
      style={{
        flex: 1,
        padding: "14px 12px",
        borderRadius: 12,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        background:
          draft.language === value ? "rgba(74,222,128,0.12)" : "var(--bg-3)",
        border: `2px solid ${draft.language === value ? "var(--green)" : "var(--border)"}`,
        color: draft.language === value ? "var(--green)" : "var(--text-3)",
        transition: "all 0.15s",
      }}
    >
      <Globe size={18} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span
        style={{
          fontSize: 10,
          fontFamily: "DM Mono, monospace",
          opacity: 0.6,
        }}
      >
        {value.toUpperCase()}
      </span>
    </button>
  );

  return (
    <PageShell>
      {showOnboarding && (
        <Onboarding
          onDone={() => {
            update("onboardingDone", true);
            setShowOnboarding(false);
          }}
        />
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
        <PageHeader
          title={t("settings_title")}
          subtitle={t("settings_subtitle")}
        >
          <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
            <button
              onClick={handleReset}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 10,
                fontSize: 13,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} /> {t("settings_reset")}
            </button>
            <button
              onClick={handleSave}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 20px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: saved ? "rgba(74,222,128,0.2)" : "var(--green)",
                border: saved ? "1px solid var(--green)" : "none",
                color: saved ? "var(--green)" : "var(--btn-on-green)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {saved ? (
                <>
                  <Check size={13} /> {t("settings_saved")}
                </>
              ) : (
                <>
                  <Save size={13} /> {t("settings_save")}
                </>
              )}
            </button>
          </div>
        </PageHeader>

        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Profile */}
            <SectionCard>
              <SectionHeader
                icon={User}
                title={t("settings_profile")}
                sub={t("settings_profile_sub")}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <FieldRow label={t("settings_display_name")}>
                  <input
                    style={inputStyle}
                    value={draft.userName}
                    onChange={(e) => set("userName", e.target.value)}
                    placeholder="Your name"
                  />
                </FieldRow>
                <FieldRow label={t("settings_designation")}>
                  <input
                    style={inputStyle}
                    value={draft.userDesignation}
                    onChange={(e) => set("userDesignation", e.target.value)}
                    placeholder="Eg. Farm Owner"
                  />
                </FieldRow>
                <FieldRow
                  label={t("settings_initials")}
                  hint={t("settings_initials_hint")}
                >
                  <input
                    style={{ ...inputStyle, maxWidth: 100 }}
                    value={draft.userInitials}
                    onChange={(e) =>
                      set(
                        "userInitials",
                        e.target.value.toUpperCase().slice(0, 2),
                      )
                    }
                    placeholder="RR"
                    maxLength={2}
                  />
                </FieldRow>
              </div>
            </SectionCard>

            {/* Appearance */}
            <SectionCard>
              <SectionHeader
                icon={Sun}
                title={t("settings_appearance")}
                sub={t("settings_appearance_sub")}
              />
              <FieldRow
                label={t("settings_theme")}
                hint={t("settings_theme_hint")}
              >
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <ThemeButton
                    value="dark"
                    label={t("settings_dark")}
                    Icon={Moon}
                  />
                  <ThemeButton
                    value="light"
                    label={t("settings_light")}
                    Icon={Sun}
                  />
                  <ThemeButton
                    value="auto"
                    label={t("settings_system")}
                    Icon={Monitor}
                  />
                </div>
              </FieldRow>

              <div style={{ marginTop: 20 }}>
                <FieldRow
                  label={t("settings_compact")}
                  hint={t("settings_compact_hint")}
                >
                  <Toggle
                    value={draft.compactMode}
                    onChange={(v) => set("compactMode", v)}
                    enabledLabel={t("common_enabled")}
                    disabledLabel={t("common_disabled")}
                  />
                </FieldRow>
              </div>
            </SectionCard>

            {/* Language */}
            <SectionCard>
              <SectionHeader
                icon={Globe}
                title={t("settings_language")}
                sub={t("settings_language_sub")}
              />
              <div style={{ display: "flex", gap: 12 }}>
                <LangButton value="en" label={t("settings_lang_en")} />
                <LangButton value="hi" label={t("settings_lang_hi")} />
              </div>
              {draft.language === "hi" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(74,222,128,0.07)",
                    border: "1px solid rgba(74,222,128,0.2)",
                    fontSize: 12,
                    color: "var(--text-2)",
                    fontFamily: "Noto Sans Devanagari, sans-serif",
                  }}
                >
                  हिंदी भाषा चुनी गई है। सहेजने के बाद पूरा ऐप हिंदी में दिखेगा।
                </div>
              )}
            </SectionCard>

            {/* Help & Onboarding */}
            <SectionCard>
              <SectionHeader
                icon={HelpCircle}
                title={t("settings_onboarding")}
                sub={t("settings_onboarding_sub")}
              />
              <button
                onClick={() => {
                  update("onboardingDone", false);
                  setShowOnboarding(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "rgba(74,222,128,0.1)",
                  border: "1px solid rgba(74,222,128,0.3)",
                  color: "var(--green)",
                  cursor: "pointer",
                }}
              >
                <HelpCircle size={14} />
                {t("settings_restart_onboarding")}
              </button>
            </SectionCard>

            {/* Display */}
            <SectionCard>
              <SectionHeader
                icon={LayoutGrid}
                title={t("settings_display_section")}
                sub={t("settings_display_sub")}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <FieldRow
                  label={t("settings_max_crops")}
                  hint={t("settings_max_crops_hint")}
                >
                  <select
                    style={inputStyle}
                    value={draft.maxResultsPerPage}
                    onChange={(e) =>
                      set("maxResultsPerPage", parseInt(e.target.value))
                    }
                  >
                    {[6, 8, 12, 16, 24].map((n) => (
                      <option key={n} value={n}>
                        {n} {t("common_per_page")}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow
                  label={t("settings_history_limit")}
                  hint={t("settings_history_hint")}
                >
                  <select
                    style={inputStyle}
                    value={draft.historyLogLimit ?? 20}
                    onChange={(e) =>
                      set("historyLogLimit", parseInt(e.target.value))
                    }
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {t("common_last")} {n} {t("common_entries")}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>
            </SectionCard>

            {/* Alerts */}
            <SectionCard>
              <SectionHeader
                icon={Bell}
                title={t("settings_alerts_section")}
                sub={t("settings_alerts_sub")}
              />
              <FieldRow label={t("settings_show_acked")}>
                <Toggle
                  value={draft.alertsShowAcked}
                  onChange={(v) => set("alertsShowAcked", v)}
                  enabledLabel={t("common_showing_all")}
                  disabledLabel={t("common_hiding_acked")}
                />
              </FieldRow>
            </SectionCard>

            {/* Data Source */}
            <SectionCard>
              <SectionHeader
                icon={Database}
                title={t("settings_data_source")}
                sub={t("settings_data_sub")}
              />
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: USE_MOCK_DATA
                    ? "rgba(245,158,11,0.08)"
                    : "rgba(74,222,128,0.08)",
                  border: `1px solid ${USE_MOCK_DATA ? "rgba(245,158,11,0.3)" : "rgba(74,222,128,0.3)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Zap
                  size={16}
                  style={{
                    color: USE_MOCK_DATA ? "var(--amber)" : "var(--green)",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    {USE_MOCK_DATA
                      ? t("settings_mock_mode")
                      : t("settings_live_mode")}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-3)",
                      marginTop: 3,
                    }}
                  >
                    {USE_MOCK_DATA
                      ? t("settings_mock_hint")
                      : `Connected to ${process.env.REACT_APP_FARM_API_URL || "http://localhost:3001/api"}`}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </main>
    </PageShell>
  );
}
