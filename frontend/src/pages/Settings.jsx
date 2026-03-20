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
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useSettings } from "../hooks/useSettings";
import { USE_MOCK_DATA } from "../data/mockData";

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

function Card({ children, style }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 24,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        ...style,
      }}
    >
      {children}
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
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</div>
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

export default function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const [saved, setSaved] = useState(false);

  // Local draft so we can save all at once
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
            padding: "0 28px",
            height: 64,
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">
              Preferences, appearance &amp; account
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
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
              <RotateCcw size={13} /> Reset
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
                color: saved ? "var(--green)" : "#0c1a0e",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {saved ? (
                <>
                  <Check size={13} /> Saved!
                </>
              ) : (
                <>
                  <Save size={13} /> Save Changes
                </>
              )}
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          <div
            style={{
              maxWidth: 720,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Profile */}
            <Card>
              <SectionHeader
                icon={User}
                title="Profile"
                sub="Your name and role shown in the sidebar"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <FieldRow label="Display Name">
                  <input
                    style={inputStyle}
                    value={draft.userName}
                    onChange={(e) => set("userName", e.target.value)}
                    placeholder="Your name"
                  />
                </FieldRow>
                <FieldRow label="Designation">
                  <input
                    style={inputStyle}
                    value={draft.userDesignation}
                    onChange={(e) => set("userDesignation", e.target.value)}
                    placeholder="e.g. Farm Owner"
                  />
                </FieldRow>
                <FieldRow
                  label="Initials"
                  hint="Shown in the sidebar avatar (max 2 chars)"
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
            </Card>

            {/* Appearance */}
            <Card>
              <SectionHeader
                icon={Sun}
                title="Appearance"
                sub="Theme and display options"
              />
              <FieldRow
                label="Theme"
                hint="Controls the overall color scheme of the application"
              >
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <ThemeButton value="dark" label="Dark" Icon={Moon} />
                  <ThemeButton value="light" label="Light" Icon={Sun} />
                  <ThemeButton value="auto" label="System" Icon={Monitor} />
                </div>
              </FieldRow>

              <div style={{ marginTop: 20 }}>
                <FieldRow
                  label="Compact Mode"
                  hint="Reduces spacing for denser information display"
                >
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
                      onClick={() => set("compactMode", !draft.compactMode)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background: draft.compactMode
                          ? "var(--green)"
                          : "var(--border)",
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
                          left: draft.compactMode ? 23 : 3,
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
                      {draft.compactMode ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                </FieldRow>
              </div>
            </Card>

            {/* Data */}
            <Card>
              <SectionHeader
                icon={LayoutGrid}
                title="Display"
                sub="Pagination and results"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <FieldRow
                  label="Max Crops Per Page"
                  hint="Dashboard grid page size"
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
                        {n} per page
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow
                  label="History Log Limit"
                  hint="Max entries shown in crop event log"
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
                        Last {n} entries
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>
            </Card>

            {/* Alerts */}
            <Card>
              <SectionHeader
                icon={Bell}
                title="Alerts"
                sub="Notification preferences"
              />
              <FieldRow label="Show Acknowledged Alerts by Default">
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
                    onClick={() =>
                      set("alertsShowAcked", !draft.alertsShowAcked)
                    }
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: draft.alertsShowAcked
                        ? "var(--green)"
                        : "var(--border)",
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
                        left: draft.alertsShowAcked ? 23 : 3,
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
                    {draft.alertsShowAcked
                      ? "Showing all"
                      : "Hiding acknowledged"}
                  </span>
                </label>
              </FieldRow>
            </Card>

            {/* Data Source */}
            <Card>
              <SectionHeader
                icon={Database}
                title="Data Source"
                sub="Backend connection settings"
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
                      ? "Mock Data Mode"
                      : "Live Backend Connected"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-3)",
                      marginTop: 3,
                    }}
                  >
                    {USE_MOCK_DATA
                      ? "To connect to live data, open src/data/mockData.js and set USE_MOCK_DATA = false"
                      : "Connected to http://localhost:3001 — real-time data"}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
