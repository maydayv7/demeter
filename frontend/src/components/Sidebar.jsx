import React, { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Leaf,
  LayoutGrid,
  BarChart3,
  Bell,
  Settings,
  Brain,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useFarmData } from "../hooks/useFarmData";
import { deriveCropStatus } from "../utils/dataUtils";
import { useSettings } from "../hooks/useSettings";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const loc = useLocation();
  const { dashboard } = useFarmData();
  const { settings } = useSettings();

  const alertCount = useMemo(() => {
    if (!dashboard?.length) return 0;
    return dashboard.filter((d) => {
      const status = deriveCropStatus(d.payload);
      return status === "Critical" || status === "Attention";
    }).length;
  }, [dashboard]);

  const NAV = [
    { label: "Crops", icon: LayoutGrid, path: "/dashboard" },
    { label: "Analytics", icon: BarChart3, path: "/analytics" },
    { label: "Alerts", icon: Bell, path: "/alerts", badge: alertCount || null },
    { label: "Agent AI", icon: Brain, path: "/control" },
    { label: "Settings", icon: Settings, path: "/settings" },
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
            background: "linear-gradient(135deg, #2d7a44, #4ade80)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
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
              AGRI·AI·v2
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

      {/* Status pill */}
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
              SYSTEM ONLINE
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
        {NAV.map(({ label, icon: Icon, path, badge }) => {
          const active = loc.pathname === path;
          return (
            <Link
              key={label}
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
              {/* Badge — unread count */}
              {badge && !collapsed && (
                <span
                  className="alert-pulse"
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    fontFamily: "DM Mono, monospace",
                    padding: "1px 5px",
                    borderRadius: 4,
                    background: "rgba(248,113,113,0.2)",
                    color: "var(--red)",
                  }}
                >
                  {badge}
                </span>
              )}
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
                    background: "var(--red)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Alert status summary */}
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
              ALERT STATUS
            </div>
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
                  {alertCount} crop{alertCount !== 1 ? "s" : ""} need attention
                </span>
              </div>
            ) : (
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
                  All clear
                </span>
              </div>
            )}
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
