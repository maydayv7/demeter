import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFarmData } from "../hooks/useFarmData";
import { useSettings } from "../hooks/useSettings";
import {
  extractSensors,
  calculateMaturity,
  deriveCropStatus,
} from "../utils/dataUtils";
import {
  Search,
  SlidersHorizontal,
  Thermometer,
  Droplet,
  ArrowUpRight,
  Clock,
  ChevronDown,
  X,
  RefreshCw,
  Leaf,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

const STAGES = ["All", "Seedling", "Vegetative", "Flowering", "Fruiting"];
const CROPS = ["All", "Lettuce", "Tomato", "Basil", "Spinach", "Cucumber"];
const STATUSES = ["All", "Healthy", "Attention", "Critical"];

const STATUS_COLORS = {
  Healthy: {
    bg: "rgba(74,222,128,0.12)",
    text: "var(--green)",
    border: "rgba(74,222,128,0.3)",
  },
  Attention: {
    bg: "rgba(245,158,11,0.12)",
    text: "var(--amber)",
    border: "rgba(245,158,11,0.3)",
  },
  Critical: {
    bg: "rgba(248,113,113,0.12)",
    text: "var(--red)",
    border: "rgba(248,113,113,0.3)",
  },
};

function CropCard({ data, onClick }) {
  const st = STATUS_COLORS[data.status] || STATUS_COLORS.Healthy;
  const maturity = data.maturity || 40;

  return (
    <div
      onClick={onClick}
      className="card-hover"
      style={{
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Image header */}
      <div
        style={{ position: "relative", height: 130, background: "var(--bg-3)" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Leaf
            size={38}
            style={{ color: "var(--border-bright)", opacity: 0.4 }}
          />
        </div>
        {data.image && (
          <img
            src={data.image}
            alt={data.name}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.7,
            }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}
        {/* Bottom fade */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, var(--surface) 0%, transparent 60%)",
          }}
        />

        {/* Status badge */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            fontSize: 10,
            fontFamily: "DM Mono, monospace",
            padding: "3px 8px",
            borderRadius: 20,
            background: st.bg,
            color: st.text,
            border: `1px solid ${st.border}`,
          }}
        >
          {data.status.toUpperCase()}
        </div>
        {/* Seq badge */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            fontSize: 10,
            fontFamily: "DM Mono, monospace",
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,0.5)",
            color: "var(--text-3)",
          }}
        >
          #{data.seq || 1}
        </div>
      </div>

      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Name */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
            {data.name}
          </div>
          <div
            style={{
              fontSize: 11,
              marginTop: 2,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
            }}
          >
            {data.cropId} · {data.statusMsg}
          </div>
        </div>

        {/* Maturity bar */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                color: "var(--text-3)",
              }}
            >
              Maturity
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "DM Mono, monospace",
                color: "var(--green)",
                fontWeight: 600,
              }}
            >
              {maturity}%
            </span>
          </div>
          <div
            style={{ height: 3, borderRadius: 2, background: "var(--border)" }}
          >
            <div
              className="progress-fill"
              style={{
                width: `${maturity}%`,
                height: "100%",
                borderRadius: 2,
                background:
                  maturity > 70
                    ? "var(--green)"
                    : maturity > 40
                      ? "var(--amber)"
                      : "var(--text-3)",
              }}
            />
          </div>
        </div>

        {/* Sensor pair */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Thermometer
              size={12}
              style={{ color: "var(--blue)", flexShrink: 0 }}
            />
            <span className="sensor-value-xs" style={{ color: "var(--blue)" }}>
              {data.sensors.temp}°C
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Droplet
              size={12}
              style={{ color: "var(--green)", flexShrink: 0 }}
            />
            <span className="sensor-value-xs" style={{ color: "var(--green)" }}>
              pH {data.sensors.ph}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--text-3)",
            }}
          >
            <Clock size={10} />
            {data.daysLeft > 0 ? `${data.daysLeft}d left` : "Ready"}
          </div>
          <ArrowUpRight size={14} style={{ color: "var(--text-3)" }} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { dashboard, loading, refreshData } = useFarmData();
  const { settings } = useSettings();
  const pageSize = settings.maxResultsPerPage || 12;

  const [crops, setCrops] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("All");
  const [filterCrop, setFilterCrop] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const getImg = (name) => {
    if (!name) return null;
    const n = name.toLowerCase();
    if (n.includes("tomato"))
      return "https://images.unsplash.com/photo-1591857177580-dc82b9e4e5c9?q=80&w=400";
    if (n.includes("basil"))
      return "https://images.unsplash.com/photo-1618164436241-4473940d1f5c?q=80&w=400";
    if (n.includes("spinach"))
      return "https://images.unsplash.com/photo-1576045057995-568f588f82fb?q=80&w=400";
    return "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=400";
  };

  useEffect(() => {
    if (dashboard) {
      setCrops(
        dashboard.map((item) => {
          const p = item.payload || {};
          const sensors = extractSensors(p);
          return {
            id: p.crop_id || item.id,
            cropId: p.crop_id || "—",
            name: p.crop || "Unknown",
            statusMsg: p.stage || "Growing",
            image: getImg(p.crop),
            status: deriveCropStatus(p),
            maturity: calculateMaturity(p.sequence_number),
            seq: p.sequence_number,
            daysLeft: 30 - (p.sequence_number || 0),
            sensors: { temp: sensors.temp, ph: sensors.ph },
            stage: p.stage || "",
            rawCrop: (p.crop || "").trim(),
          };
        }),
      );
      setPage(1);
    }
  }, [dashboard]);

  const filtered = useMemo(
    () =>
      crops.filter((c) => {
        const q = search.toLowerCase();
        if (
          q &&
          !c.name.toLowerCase().includes(q) &&
          !c.cropId.toLowerCase().includes(q) &&
          !c.statusMsg.toLowerCase().includes(q)
        )
          return false;
        if (filterStage !== "All" && c.stage !== filterStage) return false;
        if (filterCrop !== "All" && c.rawCrop !== filterCrop) return false;
        if (filterStatus !== "All" && c.status !== filterStatus) return false;
        return true;
      }),
    [crops, search, filterStage, filterCrop, filterStatus],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters = [filterStage, filterCrop, filterStatus].filter(
    (f) => f !== "All",
  ).length;

  const summary = useMemo(
    () => ({
      total: crops.length,
      healthy: crops.filter((c) => c.status === "Healthy").length,
      attention: crops.filter((c) => c.status === "Attention").length,
      critical: crops.filter((c) => c.status === "Critical").length,
    }),
    [crops],
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
            <h1 className="page-title">Crops Overview</h1>
            <p className="page-subtitle">
              {filtered.length} of {crops.length} crops shown
            </p>
          </div>

          {/* Summary chips */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 16,
            }}
          >
            {[
              {
                label: "Healthy",
                count: summary.healthy,
                color: "var(--green)",
              },
              {
                label: "Attention",
                count: summary.attention,
                color: "var(--amber)",
              },
              {
                label: "Critical",
                count: summary.critical,
                color: "var(--red)",
              },
            ].map(({ label, count, color }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  color,
                }}
              >
                <span style={{ fontWeight: 700 }}>{count}</span>
                <span style={{ opacity: 0.7 }}>{label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={refreshData}
            style={{
              marginLeft: "auto",
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
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {/* Search + filter bar */}
        <div
          style={{
            flexShrink: 0,
            padding: "8px 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-3)",
              }}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search crops, IDs, stages…"
              style={{
                width: "100%",
                paddingLeft: 32,
                paddingRight: search ? 28 : 12,
                paddingTop: 7,
                paddingBottom: 7,
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "DM Mono, monospace",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                outline: "none",
                caretColor: "var(--green)",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: "var(--text-3)",
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
              background: showFilters
                ? "rgba(74,222,128,0.1)"
                : "var(--surface)",
              border: `1px solid ${showFilters ? "rgba(74,222,128,0.3)" : "var(--border)"}`,
              color: showFilters ? "var(--green)" : "var(--text-2)",
            }}
          >
            <SlidersHorizontal size={13} />
            Filters
            {activeFilters > 0 && (
              <span
                style={{
                  padding: "0 5px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: "DM Mono, monospace",
                  background: "var(--green)",
                  color: "#0c1a0e",
                }}
              >
                {activeFilters}
              </span>
            )}
          </button>

          {/* Quick stage pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {STAGES.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setFilterStage(filterStage === s ? "All" : s);
                  setPage(1);
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontFamily: "DM Mono, monospace",
                  cursor: "pointer",
                  background:
                    filterStage === s
                      ? "rgba(74,222,128,0.15)"
                      : "var(--surface)",
                  border: `1px solid ${filterStage === s ? "rgba(74,222,128,0.4)" : "var(--border)"}`,
                  color: filterStage === s ? "var(--green)" : "var(--text-3)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div
            className="animate-fade-in"
            style={{
              flexShrink: 0,
              padding: "8px 24px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-3)",
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            {[
              {
                label: "Crop Type",
                value: filterCrop,
                set: (v) => {
                  setFilterCrop(v);
                  setPage(1);
                },
                opts: CROPS,
              },
              {
                label: "Stage",
                value: filterStage,
                set: (v) => {
                  setFilterStage(v);
                  setPage(1);
                },
                opts: STAGES,
              },
              {
                label: "Status",
                value: filterStatus,
                set: (v) => {
                  setFilterStatus(v);
                  setPage(1);
                },
                opts: STATUSES,
              },
            ].map(({ label, value, set, opts }) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--text-3)",
                  }}
                >
                  {label}
                </span>
                <div style={{ position: "relative" }}>
                  <select
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    style={{
                      appearance: "none",
                      padding: "5px 24px 5px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "DM Mono, monospace",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-2)",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {opts.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={10}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "var(--text-3)",
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                setSearch("");
                setFilterStage("All");
                setFilterCrop("All");
                setFilterStatus("All");
                setPage(1);
              }}
              style={{
                marginLeft: "auto",
                fontSize: 11,
                fontFamily: "DM Mono, monospace",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-3)",
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Crop grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                gap: 16,
              }}
            >
              {Array(8)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="shimmer"
                    style={{
                      height: 255,
                      borderRadius: 16,
                      border: "1px solid var(--border)",
                    }}
                  />
                ))}
            </div>
          ) : paginated.length > 0 ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
                  gap: 16,
                }}
              >
                {paginated.map((crop) => (
                  <CropCard
                    key={crop.id}
                    data={crop}
                    onClick={() => navigate(`/crop/${crop.id}`)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 24,
                  }}
                >
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      cursor: "pointer",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: page === 1 ? "var(--text-3)" : "var(--text-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          cursor: "pointer",
                          fontFamily: "DM Mono, monospace",
                          fontSize: 12,
                          background:
                            n === page ? "var(--green)" : "var(--surface)",
                          border: `1px solid ${n === page ? "transparent" : "var(--border)"}`,
                          color: n === page ? "#0c1a0e" : "var(--text-2)",
                          fontWeight: n === page ? 700 : 400,
                        }}
                      >
                        {n}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      cursor: "pointer",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color:
                        page === totalPages ? "var(--text-3)" : "var(--text-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
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
                <Activity size={24} style={{ color: "var(--text-3)" }} />
              </div>
              <div style={{ color: "var(--text-2)", fontSize: 14 }}>
                No crops match your filters
              </div>
              <button
                onClick={() => {
                  setSearch("");
                  setFilterStage("All");
                  setFilterCrop("All");
                  setFilterStatus("All");
                }}
                style={{
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  padding: "6px 16px",
                  borderRadius: 8,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-3)",
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
