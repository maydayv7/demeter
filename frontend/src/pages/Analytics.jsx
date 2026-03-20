import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import { useFarmData } from "../hooks/useFarmData";
import {
  extractSensors,
  avg,
  safePct,
  bucketHistory,
  dailyCropActivity,
  buildRadar,
  buildAgentStats,
} from "../utils/dataUtils";
import { TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import Sidebar from "../components/Sidebar";

// Shared Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontFamily: "DM Mono, monospace",
        background: "var(--tooltip-bg)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ color: "var(--text-3)", marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, marginTop: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// Metric Card
function MetricCard({ label, value, unit, change, color, loading }) {
  const up = change > 0;
  const flat = change === 0;
  return (
    <div
      className="card-hover"
      style={{
        borderRadius: 14,
        padding: "20px 22px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="sensor-label">{label}</div>
      {loading ? (
        <div
          className="shimmer"
          style={{ height: 36, width: 100, borderRadius: 6 }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 4,
            marginTop: 6,
          }}
        >
          <span
            className="sensor-value"
            style={{ color: color || "var(--text)" }}
          >
            {value}
          </span>
          {unit && <span className="sensor-unit">{unit}</span>}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 10,
          fontSize: 12,
          fontFamily: "DM Mono, monospace",
        }}
      >
        {flat ? (
          <Minus size={11} style={{ color: "var(--text-3)" }} />
        ) : up ? (
          <TrendingUp size={11} style={{ color: "var(--green)" }} />
        ) : (
          <TrendingDown size={11} style={{ color: "var(--red)" }} />
        )}
        <span
          style={{
            color: flat ? "var(--text-3)" : up ? "var(--green)" : "var(--red)",
          }}
        >
          {Math.abs(change)}% vs prior
        </span>
      </div>
    </div>
  );
}

function SectionHead({ label, title }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-label">{label}</div>
      <h2
        style={{
          fontWeight: 700,
          fontSize: 16,
          color: "var(--text)",
          margin: "4px 0 0",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function EmptyChart({ height = 180, message = "No data yet" }) {
  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        background: "var(--bg-3)",
        border: "1px dashed var(--border)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontFamily: "DM Mono, monospace",
          color: "var(--text-3)",
        }}
      >
        {message}
      </span>
    </div>
  );
}

// MAIN

export default function Analytics() {
  const [range, setRange] = useState("24h");
  const { dashboard, history: allPoints, loading } = useFarmData();

  const buckets = useMemo(
    () => bucketHistory(allPoints, range),
    [allPoints, range],
  );

  // Latest fleet-wide averages
  const latestSensors = useMemo(() => {
    if (!dashboard.length) return { ph: 0, ec: 0, temp: 0 };
    const s = dashboard.map((d) => extractSensors(d.payload));
    return {
      ph: parseFloat(avg(s.map((x) => parseFloat(x.ph) || 0)).toFixed(2)),
      ec: parseFloat(avg(s.map((x) => parseFloat(x.ec) || 0)).toFixed(2)),
      temp: parseFloat(avg(s.map((x) => parseFloat(x.temp) || 0)).toFixed(1)),
    };
  }, [dashboard]);

  // First-half vs second-half for % change
  const prevSensors = useMemo(() => {
    if (allPoints.length < 2) return latestSensors;
    const older = allPoints
      .slice(0, Math.floor(allPoints.length / 2))
      .map((p) => extractSensors(p.payload));
    return {
      ph: parseFloat(avg(older.map((x) => parseFloat(x.ph) || 0)).toFixed(2)),
      ec: parseFloat(avg(older.map((x) => parseFloat(x.ec) || 0)).toFixed(2)),
      temp: parseFloat(
        avg(older.map((x) => parseFloat(x.temp) || 0)).toFixed(1),
      ),
    };
  }, [allPoints, latestSensors]);

  const activityData = useMemo(() => dailyCropActivity(allPoints), [allPoints]);
  const radarData = useMemo(() => buildRadar(allPoints), [allPoints]);
  const agentStats = useMemo(() => buildAgentStats(allPoints), [allPoints]);
  const cropSummaryRows = useMemo(() => {
    if (!dashboard?.length) return [];
    return dashboard.map((item) => {
      const p = item.payload || {};
      const s = extractSensors(p);
      return { p, s, key: p.crop_id || item.id };
    });
  }, [dashboard]);

  const agentRows = agentStats;

  const handleExport = () => {
    if (!buckets.length) return;
    const header = "time,ph,ec,temp,humidity,entries";
    const rows = buckets.map(
      (b) => `${b.label},${b.ph},${b.ec},${b.temp},${b.humidity},${b.count}`,
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `demeter-analytics-${range}.csv`;
    a.click();
  };

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
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">
              {loading
                ? "Loading…"
                : `${allPoints.length} data points across ${dashboard.length} crops`}
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
            {["24h", "7d", "30d"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  cursor: "pointer",
                  background:
                    range === r ? "rgba(74,222,128,0.12)" : "var(--surface)",
                  border: `1px solid ${range === r ? "rgba(74,222,128,0.3)" : "var(--border)"}`,
                  color: range === r ? "var(--green)" : "var(--text-3)",
                }}
              >
                {r}
              </button>
            ))}
            <button
              onClick={handleExport}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "DM Mono, monospace",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {/* Metric Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
            }}
          >
            <MetricCard
              loading={loading}
              label="AVG pH"
              value={latestSensors.ph}
              unit=""
              change={safePct(latestSensors.ph, prevSensors.ph)}
              color="var(--green)"
            />
            <MetricCard
              loading={loading}
              label="AVG EC"
              value={latestSensors.ec}
              unit="dS/m"
              change={safePct(latestSensors.ec, prevSensors.ec)}
              color="var(--amber)"
            />
            <MetricCard
              loading={loading}
              label="AVG TEMP"
              value={latestSensors.temp}
              unit="°C"
              change={safePct(latestSensors.temp, prevSensors.temp)}
              color="var(--blue)"
            />
            <MetricCard
              loading={loading}
              label="TOTAL SEQUENCES"
              value={allPoints.length}
              unit=""
              change={safePct(
                allPoints.length,
                Math.max(allPoints.length - dashboard.length, 1),
              )}
              color="var(--text)"
            />
          </div>

          {/* pH + EC Charts */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            {[
              {
                title: "pH Over Time",
                key: "ph",
                stroke: "var(--green)",
                gradId: "phGradA",
                gradColor: "#4ade80",
              },
              {
                title: "EC Concentration",
                key: "ec",
                stroke: "var(--amber)",
                gradId: "ecGradA",
                gradColor: "#f59e0b",
              },
            ].map(({ title, key, stroke, gradId, gradColor }) => (
              <div
                key={key}
                style={{
                  borderRadius: 14,
                  padding: 20,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <SectionHead
                  label={`${range.toUpperCase()} TRACE`}
                  title={title}
                />
                {buckets.length < 2 ? (
                  <EmptyChart message="Not enough data for this range" />
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={buckets}>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={gradColor}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor={gradColor}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{
                          fontSize: 10,
                          fill: "var(--text-3)",
                          fontFamily: "DM Mono",
                        }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{
                          fontSize: 10,
                          fill: "var(--text-3)",
                          fontFamily: "DM Mono",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey={key}
                        stroke={stroke}
                        fill={`url(#${gradId})`}
                        strokeWidth={2}
                        dot={false}
                        name={key.toUpperCase()}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            ))}
          </div>

          {/* Temp + Humidity */}
          <div
            style={{
              borderRadius: 14,
              padding: 20,
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <SectionHead
              label={`${range.toUpperCase()} TRACE`}
              title="Temperature & Humidity"
            />
            {buckets.length < 2 ? (
              <EmptyChart message="Not enough data for this range" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={buckets}>
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 10,
                      fill: "var(--text-3)",
                      fontFamily: "DM Mono",
                    }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    domain={["auto", "auto"]}
                    tick={{
                      fontSize: 10,
                      fill: "var(--text-3)",
                      fontFamily: "DM Mono",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={["auto", "auto"]}
                    tick={{
                      fontSize: 10,
                      fill: "var(--text-3)",
                      fontFamily: "DM Mono",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temp"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    name="Temp °C"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="humidity"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    name="Humidity %"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Activity + Radar */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <div
              style={{
                borderRadius: 14,
                padding: 20,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <SectionHead
                label="DAILY ACTIVITY"
                title="Sequences Logged per Day"
              />
              {activityData.length < 2 ? (
                <EmptyChart height={180} message="Need 2+ days of data" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={activityData} barGap={4}>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="d"
                      tick={{
                        fontSize: 10,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 10,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      fill="#2d7a44"
                      radius={[4, 4, 0, 0]}
                      name="Sequences"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div
              style={{
                borderRadius: 14,
                padding: 20,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <SectionHead
                label="PARAMETER HEALTH"
                title="In-Range Score (%)"
              />
              {radarData.length < 2 ? (
                <EmptyChart height={180} message="Not enough data points" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart
                    data={radarData}
                    cx="50%"
                    cy="50%"
                    outerRadius="65%"
                  >
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{
                        fontSize: 11,
                        fill: "var(--text-3)",
                        fontFamily: "DM Mono",
                      }}
                    />
                    <Radar
                      dataKey="value"
                      stroke="var(--green)"
                      fill="rgba(74,222,128,0.15)"
                      strokeWidth={2}
                      name="In-range %"
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Crop Summary Table */}
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <SectionHead label="PER CROP" title="Latest Sensor Summary" />
            </div>
            {loading ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "DM Mono, monospace",
                    color: "var(--text-3)",
                  }}
                >
                  Loading…
                </span>
              </div>
            ) : cropSummaryRows.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  fontSize: 12,
                  fontFamily: "DM Mono, monospace",
                  color: "var(--text-3)",
                }}
              >
                No crops found in database
              </div>
            ) : (
              <table
                className="data-table"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    {[
                      "Crop ID",
                      "Type",
                      "Stage",
                      "pH",
                      "EC",
                      "Temp",
                      "Sequences",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cropSummaryRows.map(({ p, s, key }) => (
                    <tr
                      key={key}
                      style={{ transition: "background 0.12s" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-3)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: 12,
                          color: "var(--text)",
                          fontWeight: 600,
                        }}
                      >
                        {p.crop_id || "—"}
                      </td>
                      <td>{p.crop || "—"}</td>
                      <td
                        style={{
                          color: "var(--text-3)",
                          fontSize: 12,
                          fontFamily: "DM Mono, monospace",
                        }}
                      >
                        {p.stage || "—"}
                      </td>
                      <td>
                        <span
                          className="sensor-value-xs"
                          style={{ color: "var(--green)" }}
                        >
                          {s.ph}
                        </span>
                      </td>
                      <td>
                        <span
                          className="sensor-value-xs"
                          style={{ color: "var(--amber)" }}
                        >
                          {s.ec}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-3)",
                            marginLeft: 3,
                          }}
                        >
                          dS/m
                        </span>
                      </td>
                      <td>
                        <span
                          className="sensor-value-xs"
                          style={{ color: "var(--blue)" }}
                        >
                          {s.temp}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-3)",
                            marginLeft: 2,
                          }}
                        >
                          °C
                        </span>
                      </td>
                      <td
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: 13,
                          color: "var(--text-2)",
                        }}
                      >
                        {p.sequence_number || 1}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Agent Activity Table */}
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <SectionHead
                label="DERIVED FROM STORED ACTIONS"
                title="Agent Activity"
              />
            </div>
            <table
              className="data-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  {["Agent", "Appearances", "Success Rate", "Status"].map(
                    (h) => (
                      <th key={h}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {agentRows.map(({ name, decisions, accuracy }) => (
                  <tr
                    key={name}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-3)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                    style={{ transition: "background 0.12s" }}
                  >
                    <td
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "var(--text)",
                      }}
                    >
                      {name}
                    </td>
                    <td
                      style={{ fontFamily: "DM Mono, monospace", fontSize: 13 }}
                    >
                      {decisions}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            height: 6,
                            width: 100,
                            borderRadius: 3,
                            background: "var(--border)",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              borderRadius: 3,
                              width: `${accuracy}%`,
                              background:
                                accuracy > 80
                                  ? "var(--green)"
                                  : accuracy > 50
                                    ? "var(--amber)"
                                    : "var(--red)",
                              transition: "width 0.6s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 13,
                            color: "var(--text-2)",
                            minWidth: 36,
                          }}
                        >
                          {accuracy}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "DM Mono, monospace",
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: "rgba(74,222,128,0.1)",
                          color: "var(--green)",
                          border: "1px solid rgba(74,222,128,0.2)",
                        }}
                      >
                        ONLINE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
