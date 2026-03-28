import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFarmData } from "../hooks/useFarmData";
import { useSettings } from "../hooks/useSettings";
import { useT } from "../hooks/useTranslation";
import {
  extractSensors,
  calculateMaturity,
  deriveCropStatus,
  isReadyToHarvest,
  getDaysRemaining,
  SUPPORTED_CROPS,
} from "../utils/dataUtils";
import {
  SlidersHorizontal,
  Thermometer,
  Droplet,
  ArrowUpRight,
  Clock,
  RefreshCw,
  Leaf,
  Activity,
  PlusCircle,
  Scissors,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  IconButton,
  PrimaryButton,
  SearchBar,
  FilterBar,
  FilterPill,
  SelectField,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingShimmer,
} from "../components/ui";

const STAGES_KEYS = [
  "stage_all",
  "stage_seedling",
  "stage_vegetative",
  "stage_flowering",
  "stage_fruiting",
];
// Only 4 supported crops (+ All)
const CROPS = ["All", ...SUPPORTED_CROPS];
const STATUSES_KEYS = [
  "stage_all",
  "dash_healthy",
  "dash_attention",
  "dash_critical",
];

function CropCard({ data, onClick, t, td }) {
  const maturity = data.maturity || 40;
  const statusKey =
    data.status === "Healthy"
      ? "dash_healthy"
      : data.status === "Attention"
        ? "dash_attention"
        : "dash_critical";

  return (
    <div
      onClick={onClick}
      className="card-hover"
      style={{
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        background: "var(--surface)",
        border: data.harvestReady
          ? "2px solid rgba(245,158,11,0.5)"
          : "1px solid var(--border)",
        position: "relative",
      }}
    >
      {/* Harvest Ready Banner */}
      {data.harvestReady && (
        <div
          className="harvest-badge"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 5,
            padding: "5px 10px",
            background: "rgba(245,158,11,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 11,
            fontFamily: "DM Mono, monospace",
            fontWeight: 700,
            color: "#1a0a00",
          }}
        >
          <Scissors size={11} />
          {t("dash_harvest_badge")}
        </div>
      )}

      {/* Image header */}
      <div
        style={{
          position: "relative",
          height: 130,
          background: "var(--bg-3)",
          marginTop: data.harvestReady ? 27 : 0,
        }}
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

        <StatusBadge
          status={data.status}
          label={t(statusKey).toUpperCase()}
          style={{ position: "absolute", top: 10, right: 10 }}
        />
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
            {td(data.name)}
          </div>
          <div
            style={{
              fontSize: 11,
              marginTop: 2,
              fontFamily: "DM Mono, monospace",
              color: "var(--text-3)",
            }}
          >
            {data.cropId} · {td(data.statusMsg)}
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
              {t("dash_maturity")}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "DM Mono, monospace",
                color: maturity >= 80 ? "var(--amber)" : "var(--green)",
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
                  maturity >= 80
                    ? "var(--amber)"
                    : maturity > 40
                      ? "var(--green)"
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
              color: data.harvestReady ? "var(--amber)" : "var(--text-3)",
              fontWeight: data.harvestReady ? 600 : 400,
            }}
          >
            {data.harvestReady ? (
              <>
                <Scissors size={10} />
                {t("dash_ready")}
              </>
            ) : (
              <>
                <Clock size={10} />
                {data.daysLeft !== null && data.daysLeft > 0
                  ? t("dash_days_left", { n: data.daysLeft })
                  : t("dash_ready")}
              </>
            )}
          </div>
          <ArrowUpRight size={14} style={{ color: "var(--text-3)" }} />
        </div>
      </div>
    </div>
  );
}

function AddCropCard({ onClick, t }) {
  return (
    <div
      onClick={onClick}
      className="card-hover"
      style={{
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        background: "rgba(74,222,128,0.04)",
        border: "2px dashed rgba(74,222,128,0.25)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 280,
        gap: 14,
        padding: 24,
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(74,222,128,0.5)";
        e.currentTarget.style.background = "rgba(74,222,128,0.07)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)";
        e.currentTarget.style.background = "rgba(74,222,128,0.04)";
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: "rgba(74,222,128,0.12)",
          border: "1px solid rgba(74,222,128,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PlusCircle size={24} style={{ color: "var(--green)" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--green)" }}>
          {t("dash_add_crop")}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            marginTop: 4,
            fontFamily: "DM Mono, monospace",
          }}
        >
          {t("add_subtitle")}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { dashboard, loading, refreshData } = useFarmData();
  const { settings } = useSettings();
  const { t, td } = useT();
  const pageSize = settings.maxResultsPerPage || 12;

  const [crops, setCrops] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("All");
  const [filterCrop, setFilterCrop] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterReady, setFilterReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const getImg = (name) => {
    if (!name) return null;
    const n = name.toLowerCase();
    if (n.includes("tomato"))
      return "https://images.unsplash.com/photo-1571680322279-a226e6a4cc2a?q=80&w=400";
    if (n.includes("basil"))
      return "https://images.unsplash.com/photo-1618375569909-3c8616cf7733?q=80&w=400";
    if (n.includes("strawberry"))
      return "https://images.unsplash.com/photo-1677694682771-f2a1eaa7b8d9?q=80&w=400";
    // Default: lettuce
    return "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=400";
  };

  useEffect(() => {
    if (dashboard) {
      setCrops(
        dashboard.map((item) => {
          // Dashboard items are normalized: { id, payload: {...} }
          const p = item.payload || {};
          const sensors = extractSensors(p);
          const rawStage = p.stage || "";
          const daysLeft = getDaysRemaining(p);

          return {
            id: p.crop_id || item.id,
            cropId: p.crop_id || "-",
            name: p.crop || t("common_unknown"),
            statusMsg: rawStage || t("dash_status_growing"),
            image: p.image_url || getImg(p.crop),
            status: deriveCropStatus(p),
            maturity: calculateMaturity(p),
            harvestReady: isReadyToHarvest(p),
            seq: p.sequence_number,
            daysLeft: daysLeft,
            sensors: { temp: sensors.temp, ph: sensors.ph },
            stage: rawStage,
            rawCrop: (p.crop || "").trim(),
          };
        }),
      );
      setPage(1);
    }
  }, [dashboard, t]);

  const harvestReadyCrops = useMemo(
    () => crops.filter((c) => c.harvestReady),
    [crops],
  );

  const filtered = useMemo(
    () =>
      crops.filter((c) => {
        const q = search.toLowerCase();
        if (
          q &&
          !c.name.toLowerCase().includes(q) &&
          !c.cropId.toLowerCase().includes(q) &&
          !td(c.statusMsg).toLowerCase().includes(q)
        )
          return false;
        if (
          filterStage !== "All" &&
          c.stage.toLowerCase() !== filterStage.toLowerCase()
        )
          return false;
        if (filterCrop !== "All" && c.rawCrop !== filterCrop) return false;
        if (filterStatus !== "All" && c.status !== filterStatus) return false;
        if (filterReady && !c.harvestReady) return false;
        return true;
      }),
    [crops, search, filterStage, filterCrop, filterStatus, filterReady, td],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters =
    [filterStage, filterCrop, filterStatus].filter((f) => f !== "All").length +
    (filterReady ? 1 : 0);

  const summary = useMemo(
    () => ({
      total: crops.length,
      healthy: crops.filter((c) => c.status === "Healthy").length,
      attention: crops.filter((c) => c.status === "Attention").length,
      critical: crops.filter((c) => c.status === "Critical").length,
    }),
    [crops],
  );

  const STAGES_EN = ["All", "Seedling", "Vegetative", "Flowering", "Fruiting"];
  const STATUS_EN = ["All", "Healthy", "Attention", "Critical"];

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title={t("dash_title")}
        subtitle={t("dash_subtitle", {
          filtered: filtered.length,
          total: crops.length,
        })}
      >
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
              labelKey: "dash_healthy",
              count: summary.healthy,
              color: "var(--green)",
            },
            {
              labelKey: "dash_attention",
              count: summary.attention,
              color: "var(--amber)",
            },
            {
              labelKey: "dash_critical",
              count: summary.critical,
              color: "var(--red)",
            },
          ].map(({ labelKey, count, color }) => (
            <div
              key={labelKey}
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
              <span style={{ opacity: 0.7 }}>{t(labelKey)}</span>
            </div>
          ))}
        </div>

        <PrimaryButton
          onClick={() => navigate("/add-crop")}
          icon={PlusCircle}
          style={{ marginLeft: "auto" }}
        >
          {t("dash_add_crop")}
        </PrimaryButton>

        <IconButton onClick={refreshData}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </IconButton>
      </PageHeader>

      {harvestReadyCrops.length > 0 && (
        <div
          className="animate-fade-in"
          style={{
            flexShrink: 0,
            padding: "10px 24px",
            background: "rgba(245,158,11,0.12)",
            borderBottom: "1px solid rgba(245,158,11,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            className="harvest-pulse"
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--amber)",
              flexShrink: 0,
            }}
          />
          <Scissors
            size={16}
            style={{ color: "var(--amber)", flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <span
              style={{ fontWeight: 700, fontSize: 13, color: "var(--amber)" }}
            >
              {t("dash_harvest_banner", {
                n: harvestReadyCrops.length,
                s: harvestReadyCrops.length !== 1 ? "s" : "",
              })}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-3)",
                marginLeft: 10,
                fontFamily: "DM Mono, monospace",
              }}
            >
              {t("dash_harvest_banner_sub")}
            </span>
          </div>
          <button
            onClick={() => {
              setFilterReady(true);
              setFilterStatus("All");
              setFilterStage("All");
              setFilterCrop("All");
              setSearch("");
              setPage(1);
            }}
            style={{
              padding: "5px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "DM Mono, monospace",
              background: "rgba(245,158,11,0.2)",
              border: "1px solid rgba(245,158,11,0.4)",
              color: "var(--amber)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {t("dash_harvest_action")}
          </button>
        </div>
      )}

      <FilterBar>
        <SearchBar
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          onClear={() => setSearch("")}
          placeholder={t("dash_search_placeholder")}
        />

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
            background: showFilters ? "rgba(74,222,128,0.1)" : "var(--surface)",
            border: `1px solid ${showFilters ? "rgba(74,222,128,0.3)" : "var(--border)"}`,
            color: showFilters ? "var(--green)" : "var(--text-2)",
          }}
        >
          <SlidersHorizontal size={13} /> {t("dash_filters")}
          {activeFilters > 0 && (
            <span
              style={{
                padding: "0 5px",
                borderRadius: 4,
                fontSize: 10,
                fontFamily: "DM Mono, monospace",
                background: "var(--green)",
                color: "var(--btn-on-green)",
              }}
            >
              {activeFilters}
            </span>
          )}
        </button>

        {/* Quick stage pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {STAGES_EN.slice(0, 4).map((s, i) => (
            <FilterPill
              key={s}
              active={filterStage === s}
              onClick={() => {
                setFilterStage(filterStage === s ? "All" : s);
                setPage(1);
              }}
            >
              {t(STAGES_KEYS[i])}
            </FilterPill>
          ))}
        </div>
      </FilterBar>

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
              label: t("add_field_crop_type"),
              value: filterCrop,
              set: (v) => {
                setFilterCrop(v);
                setPage(1);
              },
              opts: CROPS,
              optLabels: CROPS.map((o) =>
                o === "All" ? t("stage_all") : td(o),
              ),
            },
            {
              label: t("add_field_stage"),
              value: filterStage,
              set: (v) => {
                setFilterStage(v);
                setPage(1);
              },
              opts: STAGES_EN,
              optLabels: STAGES_KEYS.map((k) => t(k)),
            },
            {
              label: t("analytics_th_status"),
              value: filterStatus,
              set: (v) => {
                setFilterStatus(v);
                setPage(1);
              },
              opts: STATUS_EN,
              optLabels: STATUSES_KEYS.map((k) => t(k)),
            },
          ].map(({ label, value, set, opts, optLabels }) => (
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
              <SelectField
                value={value}
                onChange={(e) => set(e.target.value)}
                options={opts.map((o, i) => ({
                  value: o,
                  label: optLabels ? optLabels[i] : o,
                }))}
              />
            </div>
          ))}
          <button
            onClick={() => {
              setSearch("");
              setFilterStage("All");
              setFilterCrop("All");
              setFilterStatus("All");
              setFilterReady(false);
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
            {t("dash_clear_all")}
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
              gap: 16,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <LoadingShimmer key={i} count={1} height={255} />
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
                  t={t}
                  td={td}
                  onClick={() => navigate(`/crop/${crop.id}`)}
                />
              ))}
              {/* Always visible at end of last page */}
              {page === totalPages && !filterReady && (
                <AddCropCard onClick={() => navigate("/add-crop")} t={t} />
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                setPage={setPage}
                style={{ marginTop: 24 }}
              />
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
            {crops.length === 0 ? (
              <EmptyState
                icon={PlusCircle}
                title={t("dash_no_crops")}
                description={t("dash_no_crops_sub")}
              />
            ) : (
              <EmptyState
                icon={Activity}
                title={t("dash_no_match")}
                description={
                  <button
                    onClick={() => {
                      setSearch("");
                      setFilterStage("All");
                      setFilterCrop("All");
                      setFilterStatus("All");
                      setFilterReady(false);
                      setPage(1);
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
                      marginTop: 16,
                    }}
                  >
                    {t("dash_clear_filters")}
                  </button>
                }
              />
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
