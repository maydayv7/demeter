import React, { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Leaf,
  LayoutGrid,
  BarChart3,
  Bell,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useFarmData } from "../hooks/useFarmData";
import { deriveCropStatus, isReadyToHarvest } from "../utils/dataUtils";
import { useSettings } from "../hooks/useSettings";
import { useT } from "../hooks/useTranslation";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const loc = useLocation();
  const { dashboard } = useFarmData();
  const { settings } = useSettings();
  const { t } = useT();

  const alertCount = useMemo(() => {
    if (!dashboard?.length) return 0;
    return dashboard.filter((d) => {
      const status = deriveCropStatus(d.payload);
      return status === "Critical" || status === "Attention";
    }).length;
  }, [dashboard]);

  const harvestCount = useMemo(() => {
    if (!dashboard?.length) return 0;
    return dashboard.filter((d) => isReadyToHarvest(d.payload)).length;
  }, [dashboard]);

  const totalBadge = alertCount + harvestCount;

  const NAV = [
    { labelKey: "nav_crops", icon: LayoutGrid, path: "/dashboard" },
    {
      labelKey: "nav_alerts",
      icon: Bell,
      path: "/alerts",
      badge: totalBadge || null,
      harvest: harvestCount,
    },
    { labelKey: "nav_analytics", icon: BarChart3, path: "/analytics" },
    { labelKey: "nav_intelligence", icon: Sparkles, path: "/intelligence" },
    { labelKey: "nav_settings", icon: Settings, path: "/settings" },
  ];

  const initials =
    settings.userInitials ||
    (settings.userName || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <aside
      style={{
        width: collapsed ? 64 : 220,
        background: "var(--bg-2)",
        borderRight: "1px solid var(--border)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        transition: "width 300ms ease",
        overflow: "visible",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: collapsed ? "20px 0" : "20px 16px",
          justifyContent: collapsed ? "center" : "flex-start",
          borderBottom: "1px solid var(--border)",
          height: 64,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            flexShrink: 0,
            background: "linear-gradient(135deg, #2d7a44, #4ade80)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Leaf size={15} fill="white" color="white" />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "var(--text)",
                lineHeight: 1.2,
              }}
            >
              Demeter
            </div>
            <div
              style={{
                fontSize: 9,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
                letterSpacing: "0.1em",
              }}
            >
              {t("sidebar_agri_ai")}
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: "absolute",
          top: 20,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          color: "var(--text-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* System status pill */}
      {!collapsed && (
        <div style={{ padding: "12px 12px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
            }}
          >
            <span
              className="status-dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--green)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--green)",
              }}
            >
              {t("nav_system_online")}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: "12px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {NAV.map(({ labelKey, icon: Icon, path, badge, harvest }) => {
          const active = loc.pathname === path;
          const label = t(labelKey);
          return (
            <Link
              key={labelKey}
              to={path}
              title={collapsed ? label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "10px 0" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 10,
                background: active ? "rgba(74,222,128,0.12)" : "transparent",
                color: active ? "var(--green)" : "var(--text-2)",
                border: active
                  ? "1px solid rgba(74,222,128,0.25)"
                  : "1px solid transparent",
                textDecoration: "none",
                position: "relative",
                transition: "all 0.15s",
              }}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
              )}

              {/* Badge (expanded) */}
              {badge && !collapsed && (
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {alertCount > 0 && (
                    <span
                      className="alert-pulse"
                      style={{
                        fontSize: 10,
                        fontFamily: "DM Mono, monospace",
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "rgba(248,113,113,0.2)",
                        color: "var(--red)",
                      }}
                    >
                      {alertCount}
                    </span>
                  )}
                  {harvest > 0 && (
                    <span
                      className="harvest-pulse"
                      style={{
                        fontSize: 10,
                        fontFamily: "DM Mono, monospace",
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "rgba(245,158,11,0.2)",
                        color: "var(--amber)",
                      }}
                    >
                      🌾 {harvest}
                    </span>
                  )}
                </div>
              )}
              {/* Badge (collapsed) */}
              {badge && collapsed && (
                <span
                  className="alert-pulse"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: alertCount > 0 ? "var(--red)" : "var(--amber)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Alert / harvest status */}
      {!collapsed && (
        <div style={{ padding: "0 12px 12px" }}>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="section-label"
              style={{ margin: 0, marginBottom: 6, fontSize: 9 }}
            >
              {t("nav_alert_status")}
            </div>

            {/* Harvest ready row */}
            {harvestCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: alertCount > 0 ? 5 : 0,
                }}
              >
                <span
                  className="harvest-pulse"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--amber)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--amber)",
                  }}
                >
                  {t("nav_harvest_ready", { n: harvestCount })}
                </span>
              </div>
            )}

            {alertCount > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  className="alert-pulse"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--red)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--red)",
                  }}
                >
                  {t("nav_crops_need_attention", {
                    n: alertCount,
                    s: alertCount !== 1 ? "s" : "",
                  })}
                </span>
              </div>
            ) : harvestCount === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  className="status-dot"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--green)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--green)",
                  }}
                >
                  {t("nav_all_clear")}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* User row */}
      <div
        style={{
          padding: collapsed ? "12px 8px" : "12px 12px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(245,158,11,0.15)",
            color: "var(--amber)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        {!collapsed && (
          <div>
            <div
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}
            >
              {settings.userName}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>
              {settings.userDesignation}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
