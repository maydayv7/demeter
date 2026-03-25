// Number formatting
export const formatNumber = (val, decimals = 2) => {
  if (val === undefined || val === null || isNaN(parseFloat(val))) return "0";
  const factor = Math.pow(10, decimals);
  return Math.round(parseFloat(val) * factor) / factor;
};

// Python dict / JSON string parser
export const parsePythonString = (str) => {
  if (!str) return null;
  if (typeof str === "object") return str;
  try {
    return JSON.parse(str);
  } catch {
    try {
      const fixed = str
        .replace(/'/g, '"')
        .replace(/\bNone\b/g, "null")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bTrue\b/g, "true");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
};

// Sensor extraction
function pickVal(obj, ...keys) {
  if (!obj || typeof obj !== "object") return undefined;
  const lower = {};
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k];
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
    if (lower[k.toLowerCase()] !== undefined) return lower[k.toLowerCase()];
  }
  return undefined;
}

export const extractSensors = (payload) => {
  if (!payload) return { temp: 0, ph: 0, humidity: 0, ec: 0 };

  let raw = payload.sensors || payload.sensor_data || null;

  if (!raw) {
    const action = parsePythonString(payload.action_taken);
    if (action && typeof action === "object") {
      raw = {
        temp: action.atmospheric_actions?.air_temp ?? action.air_temp ?? 0,
        ph: action.water_actions?.ph ?? action.ph ?? 0,
        humidity: action.atmospheric_actions?.humidity ?? action.humidity ?? 0,
        ec: action.water_actions?.ec ?? action.ec ?? 0,
      };
    } else {
      raw = payload;
    }
  }

  return {
    temp: formatNumber(
      pickVal(raw, "temp", "Temp", "air_temp", "temperature") ?? 0,
    ),
    ph: formatNumber(pickVal(raw, "pH", "ph", "PH") ?? 7.0),
    humidity: formatNumber(pickVal(raw, "humidity", "Humidity", "RH") ?? 0),
    ec: formatNumber(pickVal(raw, "EC", "ec", "conductivity") ?? 0),
  };
};

// Plant maturity (based on cycle count)
export const calculateMaturity = (seq) => Math.min((seq || 1) * 10, 100);

// Returns true if the crop is ready to harvest
// Criteria: maturity >= 80% AND not in Critical status
export const isReadyToHarvest = (payload) => {
  if (!payload) return false;
  const maturity = calculateMaturity(payload.sequence_number);
  const status = deriveCropStatus(payload);
  return maturity >= 80 && status !== "Critical";
};

// Outcome string formatting
export const formatOutcome = (outcome) => {
  if (!outcome || typeof outcome !== "string") return "Monitoring...";

  // Strip reward suffix
  const cleanOutcome = outcome.split("| Reward:")[0].trim();

  const parts = cleanOutcome.split("|").map((p) => p.trim());
  let tags = [];
  let notes = "";

  parts.forEach((part) => {
    if (part.startsWith("condition_assessed")) {
      const v = part.replace("condition_assessed", "").trim();
      if (v) tags.push(`Condition: ${v}`);
    } else if (part.startsWith("health_score:")) {
      const v = part.replace("health_score:", "").trim();
      if (v) tags.push(`Health: ${v}`);
    } else if (part.startsWith("notes:")) {
      notes = part.replace("notes:", "").trim();
    } else if (part) {
      tags.push(part);
    }
  });

  if (!tags.length && !notes) return cleanOutcome;
  const t = tags.join(" · ");
  return t && notes ? `${t} — ${notes}` : t || notes;
};

// Crop health status
export const deriveCropStatus = (payload) => {
  if (!payload) return "Healthy";

  const s = extractSensors(payload);
  const ph = parseFloat(s.ph) || 0;
  const ec = parseFloat(s.ec) || 0;
  const temp = parseFloat(s.temp) || 0;
  const outcome = (payload.outcome || "").toLowerCase();
  const action = (payload.action_taken || "").toUpperCase();

  // Critical thresholds
  if (
    (ph > 0 && ph < 4.5) ||
    ph > 7.5 ||
    ec > 3.5 ||
    (temp > 0 && temp < 10) ||
    temp > 35 ||
    /fail|critical|disease|error/.test(outcome) ||
    /DISEASE|FUNGAL|PEST/.test(action)
  )
    return "Critical";

  // Warning thresholds
  if (
    (ph > 0 && ph < 5.5) ||
    ph > 6.5 ||
    ec > 2.5 ||
    (temp > 0 && temp < 17) ||
    temp > 30 ||
    /deteriorat|negative|attention|decline/.test(outcome) ||
    /FLUSH|PRUNE|BOOST/.test(action)
  )
    return "Attention";

  return "Healthy";
};

// Alert generation
function timeAgo(isoString, t) {
  if (!isoString) return t("common_unknown");
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("common_time_just_now");
  if (mins < 60) return t("common_time_min_ago", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("common_time_hr_ago", { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days === 1) return t("common_time_day_ago", { n: 1 });
  return t("common_time_days_ago", { n: days });
}

// Generate alerts from data points
export const generateAlerts = (points, t) => {
  // Default translate
  const _t =
    t ||
    ((key, vars = {}) => {
      const en = {
        alert_harvest_title: "Crop ready for harvest",
        alert_harvest_desc:
          "{crop} ({id}) has reached {pct}% maturity — time to harvest!",
        alert_ph_low_title: "pH critically low",
        alert_ph_low_desc:
          "{crop} ({id}): pH at {val} — immediate base dosing required.",
        alert_ph_high_title: "pH critically high",
        alert_ph_high_desc:
          "{crop} ({id}): pH at {val} — acid dosing required immediately.",
        alert_ec_high_title: "EC dangerously high",
        alert_ec_high_desc:
          "{crop} ({id}): EC at {val} dS/m — severe nutrient burn risk.",
        alert_temp_cold_title: "Temperature too cold",
        alert_temp_cold_desc:
          "{crop} ({id}): Air temp at {val}°C — root damage risk.",
        alert_temp_hot_title: "Temperature too hot",
        alert_temp_hot_desc:
          "{crop} ({id}): Air temp at {val}°C — heat stress and root rot risk.",
        alert_disease_title: "Disease or pest detected",
        alert_disease_desc:
          '{crop} ({id}): Visual anomaly. Outcome: "{outcome}"',
        alert_cycle_fail_title: "Cycle failure recorded",
        alert_cycle_fail_desc: '{crop} ({id}): Seq #{seq} outcome: "{outcome}"',
        alert_ph_warn_low_title: "pH below optimal range",
        alert_ph_warn_desc: "{crop} ({id}): pH at {val}. Target 5.5–6.5.",
        alert_ph_warn_high_title: "pH above optimal range",
        alert_ec_warn_title: "EC approaching high limit",
        alert_ec_warn_desc:
          "{crop} ({id}): EC at {val} dS/m — nutrient burn risk increasing.",
        alert_temp_warn_low_title: "Temperature on the low side",
        alert_temp_warn_low_desc:
          "{crop} ({id}): {val}°C — slow growth expected.",
        alert_temp_warn_high_title: "Temperature elevated",
        alert_temp_warn_high_desc:
          "{crop} ({id}): {val}°C — heat stress likely.",
        alert_deteriorating_title: "Condition deteriorating",
        alert_deteriorating_desc: '{crop} ({id}): Seq #{seq} — "{outcome}"',
        alert_cycle_done_title: "Cycle #{seq} completed",
        alert_cycle_done_desc: "{crop} ({id}): Sequence stored. {extra}",
        common_time_just_now: "just now",
        common_time_min_ago: "{n} min ago",
        common_time_hr_ago: "{n} hr ago",
        common_time_day_ago: "1 day ago",
        common_time_days_ago: "{n} days ago",
        common_unknown: "Unknown",
      };
      let str = en[key] ?? key;
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
      return str;
    });

  const alerts = [];
  let id = 1;

  for (const p of points) {
    const payload = p.payload || {};
    const s = extractSensors(payload);
    const ph = parseFloat(s.ph) || 0;
    const ec = parseFloat(s.ec) || 0;
    const temp = parseFloat(s.temp) || 0;
    const ts = payload.timestamp;
    const cropId = payload.crop_id || "UNKNOWN";
    const cropName = payload.crop || "Crop";
    const action = (payload.action_taken || "").toUpperCase();
    const outcome = (payload.outcome || "").toLowerCase();
    const strategy = (payload.strategic_intent || "").toUpperCase();
    const seq = payload.sequence_number;
    const outcomeFormatted = formatOutcome(payload.outcome);

    // HARVEST READY ALERT
    if (isReadyToHarvest(payload)) {
      const maturity = calculateMaturity(seq);
      alerts.push({
        id: id++,
        severity: "info",
        titleKey: "alert_harvest_title",
        descKey: "alert_harvest_desc",
        title: _t("alert_harvest_title"),
        desc: _t("alert_harvest_desc", {
          crop: cropName,
          id: cropId,
          pct: maturity,
        }),
        time: timeAgo(ts, _t),
        ts,
        agent: "SUPERVISOR",
        crop: cropName,
        ack: false,
        isHarvestAlert: true,
        titleVars: {},
        descVars: { crop: cropName, id: cropId, pct: maturity },
      });
    }

    // Critical
    if (ph > 0 && ph < 4.5)
      alerts.push({
        id: id++,
        severity: "critical",
        title: _t("alert_ph_low_title"),
        desc: _t("alert_ph_low_desc", { crop: cropName, id: cropId, val: ph }),
        titleKey: "alert_ph_low_title",
        descKey: "alert_ph_low_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: ph },
        time: timeAgo(ts, _t),
        ts,
        agent: "WATER",
        crop: cropName,
        ack: false,
      });
    else if (ph > 7.5)
      alerts.push({
        id: id++,
        severity: "critical",
        title: _t("alert_ph_high_title"),
        desc: _t("alert_ph_high_desc", {
          crop: cropName,
          id: cropId,
          val: ph,
        }),
        titleKey: "alert_ph_high_title",
        descKey: "alert_ph_high_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: ph },
        time: timeAgo(ts, _t),
        ts,
        agent: "WATER",
        crop: cropName,
        ack: false,
      });

    if (ec > 3.5)
      alerts.push({
        id: id++,
        severity: "critical",
        title: _t("alert_ec_high_title"),
        desc: _t("alert_ec_high_desc", {
          crop: cropName,
          id: cropId,
          val: ec,
        }),
        titleKey: "alert_ec_high_title",
        descKey: "alert_ec_high_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: ec },
        time: timeAgo(ts, _t),
        ts,
        agent: "WATER",
        crop: cropName,
        ack: false,
      });

    if (temp > 0 && temp < 10)
      alerts.push({
        id: id++,
        severity: "critical",
        title: _t("alert_temp_cold_title"),
        desc: _t("alert_temp_cold_desc", {
          crop: cropName,
          id: cropId,
          val: temp,
        }),
        titleKey: "alert_temp_cold_title",
        descKey: "alert_temp_cold_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: temp },
        time: timeAgo(ts, _t),
        ts,
        agent: "ATMOSPHERIC",
        crop: cropName,
        ack: false,
      });
    else if (temp > 35)
      alerts.push({
        id: id++,
        severity: "critical",
        title: _t("alert_temp_hot_title"),
        desc: _t("alert_temp_hot_desc", {
          crop: cropName,
          id: cropId,
          val: temp,
        }),
        titleKey: "alert_temp_hot_title",
        descKey: "alert_temp_hot_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: temp },
        time: timeAgo(ts, _t),
        ts,
        agent: "ATMOSPHERIC",
        crop: cropName,
        ack: false,
      });

    if (
      /disease|fungal|pest|mildew|blight|mite|rot/.test(outcome) ||
      /DISEASE|FUNGAL|PEST/.test(action)
    )
      alerts.push({
        id: id++,
        severity: "critical",
        title: _t("alert_disease_title"),
        desc: _t("alert_disease_desc", {
          crop: cropName,
          id: cropId,
          outcome: outcomeFormatted,
        }),
        titleKey: "alert_disease_title",
        descKey: "alert_disease_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, outcome: outcomeFormatted },
        time: timeAgo(ts, _t),
        ts,
        agent: "DOCTOR",
        crop: cropName,
        ack: false,
      });

    if (/fail|critical|error/.test(outcome))
      alerts.push({
        id: id++,
        severity: "critical",
        title: _t("alert_cycle_fail_title"),
        desc: _t("alert_cycle_fail_desc", {
          crop: cropName,
          id: cropId,
          seq,
          outcome: outcomeFormatted,
        }),
        titleKey: "alert_cycle_fail_title",
        descKey: "alert_cycle_fail_desc",
        titleVars: {},
        descVars: {
          crop: cropName,
          id: cropId,
          seq,
          outcome: outcomeFormatted,
        },
        time: timeAgo(ts, _t),
        ts,
        agent: "JUDGE",
        crop: cropName,
        ack: false,
      });

    // Warning
    if (ph >= 4.5 && ph < 5.5)
      alerts.push({
        id: id++,
        severity: "warning",
        title: _t("alert_ph_warn_low_title"),
        desc: _t("alert_ph_warn_desc", {
          crop: cropName,
          id: cropId,
          val: ph,
        }),
        titleKey: "alert_ph_warn_low_title",
        descKey: "alert_ph_warn_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: ph },
        time: timeAgo(ts, _t),
        ts,
        agent: "WATER",
        crop: cropName,
        ack: false,
      });
    else if (ph > 6.6 && ph <= 7.5)
      alerts.push({
        id: id++,
        severity: "warning",
        title: _t("alert_ph_warn_high_title"),
        desc: _t("alert_ph_warn_desc", {
          crop: cropName,
          id: cropId,
          val: ph,
        }),
        titleKey: "alert_ph_warn_high_title",
        descKey: "alert_ph_warn_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: ph },
        time: timeAgo(ts, _t),
        ts,
        agent: "WATER",
        crop: cropName,
        ack: false,
      });

    if (ec >= 2.5 && ec <= 3.5)
      alerts.push({
        id: id++,
        severity: "warning",
        title: _t("alert_ec_warn_title"),
        desc: _t("alert_ec_warn_desc", {
          crop: cropName,
          id: cropId,
          val: ec,
        }),
        titleKey: "alert_ec_warn_title",
        descKey: "alert_ec_warn_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: ec },
        time: timeAgo(ts, _t),
        ts,
        agent: "SUPERVISOR",
        crop: cropName,
        ack: false,
      });

    if (temp >= 10 && temp < 17)
      alerts.push({
        id: id++,
        severity: "warning",
        title: _t("alert_temp_warn_low_title"),
        desc: _t("alert_temp_warn_low_desc", {
          crop: cropName,
          id: cropId,
          val: temp,
        }),
        titleKey: "alert_temp_warn_low_title",
        descKey: "alert_temp_warn_low_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: temp },
        time: timeAgo(ts, _t),
        ts,
        agent: "ATMOSPHERIC",
        crop: cropName,
        ack: false,
      });
    else if (temp >= 30 && temp <= 35)
      alerts.push({
        id: id++,
        severity: "warning",
        title: _t("alert_temp_warn_high_title"),
        desc: _t("alert_temp_warn_high_desc", {
          crop: cropName,
          id: cropId,
          val: temp,
        }),
        titleKey: "alert_temp_warn_high_title",
        descKey: "alert_temp_warn_high_desc",
        titleVars: {},
        descVars: { crop: cropName, id: cropId, val: temp },
        time: timeAgo(ts, _t),
        ts,
        agent: "ATMOSPHERIC",
        crop: cropName,
        ack: false,
      });

    if (/deteriorat|negative|attention|decline/.test(outcome))
      alerts.push({
        id: id++,
        severity: "warning",
        title: _t("alert_deteriorating_title"),
        desc: _t("alert_deteriorating_desc", {
          crop: cropName,
          id: cropId,
          seq,
          outcome: outcomeFormatted,
        }),
        titleKey: "alert_deteriorating_title",
        descKey: "alert_deteriorating_desc",
        titleVars: {},
        descVars: {
          crop: cropName,
          id: cropId,
          seq,
          outcome: outcomeFormatted,
        },
        time: timeAgo(ts, _t),
        ts,
        agent: "JUDGE",
        crop: cropName,
        ack: false,
      });

    // Info
    if (seq && !/fail|critical|error|deteriorat|negative/.test(outcome)) {
      const extra = [
        strategy ? `Strategy: ${strategy}.` : "",
        payload.reward_score != null ? `Reward: ${payload.reward_score}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      alerts.push({
        id: id++,
        severity: "info",
        title: _t("alert_cycle_done_title", { seq }),
        desc: _t("alert_cycle_done_desc", {
          crop: cropName,
          id: cropId,
          extra,
        }).trim(),
        titleKey: "alert_cycle_done_title",
        descKey: "alert_cycle_done_desc",
        titleVars: { seq },
        descVars: { crop: cropName, id: cropId, extra },
        time: timeAgo(ts, _t),
        ts,
        agent: strategy ? "SUPERVISOR" : "JUDGE",
        crop: cropName,
        ack: true,
      });
    }
  }

  // Deduplicate — max 2 per severity+title+crop
  const seen = new Map();
  const deduped = [];
  for (const a of alerts) {
    const key = `${a.severity}|${a.titleKey}|${a.crop}`;
    const count = seen.get(key) || 0;
    if (count < 2) {
      deduped.push(a);
      seen.set(key, count + 1);
    }
  }

  const sevOrder = { critical: 0, warning: 1, info: 2 };
  deduped.sort((a, b) => {
    if (a.isHarvestAlert && !b.isHarvestAlert) return -1;
    if (!a.isHarvestAlert && b.isHarvestAlert) return 1;
    return sevOrder[a.severity] !== sevOrder[b.severity]
      ? sevOrder[a.severity] - sevOrder[b.severity]
      : new Date(b.ts || 0) - new Date(a.ts || 0);
  });

  return deduped;
};

// Analytics helpers
export const avg = (arr) => {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
};

export const safePct = (current, previous) => {
  if (!previous) return 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
};

export const bucketHistory = (points, range) => {
  if (!points.length) return [];

  const now = Date.now();
  const MS = { "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
  const cutoff = now - (MS[range] || MS["24h"]);

  const filtered = points.filter(
    (p) => new Date(p.payload?.timestamp || 0).getTime() >= cutoff,
  );
  if (!filtered.length) return [];

  const bucketSize = range === "24h" ? 3600000 : 86400000;
  const buckets = new Map();

  for (const p of filtered) {
    const t = new Date(p.payload?.timestamp || 0).getTime();
    const key = Math.floor(t / bucketSize) * bucketSize;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, pts]) => {
      const date = new Date(ts);
      const label =
        range === "24h"
          ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : date.toLocaleDateString([], { month: "short", day: "numeric" });
      const sensors = pts.map((p) => extractSensors(p.payload));
      return {
        label,
        ph: parseFloat(
          avg(sensors.map((s) => parseFloat(s.ph) || 0)).toFixed(2),
        ),
        ec: parseFloat(
          avg(sensors.map((s) => parseFloat(s.ec) || 0)).toFixed(2),
        ),
        temp: parseFloat(
          avg(sensors.map((s) => parseFloat(s.temp) || 0)).toFixed(1),
        ),
        humidity: parseFloat(
          avg(sensors.map((s) => parseFloat(s.humidity) || 0)).toFixed(1),
        ),
        count: pts.length,
      };
    });
};

export const dailyCropActivity = (points) => {
  const map = new Map();
  for (const p of points) {
    const ts = p.payload?.timestamp;
    if (!ts) continue;
    const day = new Date(ts).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    map.set(day, (map.get(day) || 0) + 1);
  }
  const last7 = Array.from(map.entries()).slice(-7);
  const maxVal = Math.max(...last7.map((e) => e[1]), 1);
  return last7.map(([d, count]) => ({
    d,
    count,
    target: Math.ceil(maxVal * 1.2),
  }));
};

export const buildRadar = (points) => {
  if (!points.length) return [];
  const sensors = points.map((p) => extractSensors(p.payload));
  const check = (vals, lo, hi) => {
    const inRange = vals.filter((v) => v >= lo && v <= hi).length;
    return Math.round((inRange / vals.length) * 100);
  };
  return [
    {
      metric: "pH",
      value: check(
        sensors.map((s) => parseFloat(s.ph)),
        5.5,
        6.5,
      ),
    },
    {
      metric: "EC",
      value: check(
        sensors.map((s) => parseFloat(s.ec)),
        0.8,
        2.5,
      ),
    },
    {
      metric: "Temp",
      value: check(
        sensors.map((s) => parseFloat(s.temp)),
        18,
        28,
      ),
    },
    {
      metric: "Humidity",
      value: check(
        sensors.map((s) => parseFloat(s.humidity)),
        40,
        80,
      ),
    },
  ];
};

// Counts appearances by scanning strategic_intent field
const AGENT_INTENTS = {
  SUPERVISOR: [
    "MAINTAIN_CURRENT",
    "CALIBRATE",
    "GENTLE_PH",
    "AGGRESSIVE_PH",
    "LOWER_EC",
    "CALMAG",
    "PRUNE",
  ],
  WATER: ["PH_DOWN", "PH_UP", "EC_VEG", "EC_BLOOM", "FLUSH", "CALMAG_BOOST"],
  ATMOSPHERIC: ["RAISE_TEMP", "LOWER_TEMP", "MAX_AIR", "VPD"],
  JUDGE: ["IMPROVED", "STABLE", "DETERIORATED"],
  DOCTOR: ["FUNGAL", "PEST", "DISEASE", "VISUAL"],
};

export const buildAgentStats = (points) => {
  if (!points.length) return [];

  const total = points.length;

  // Count positive outcomes for accuracy
  const positiveCount = points.filter((p) => {
    const o = (p.payload?.outcome || "").toLowerCase();
    return !/fail|negative|critical|deteriorat/.test(o);
  }).length;
  const baseAccuracy = Math.round((positiveCount / total) * 100);

  // Count how many points each agent's keywords appear in
  const counts = {};
  for (const [agent, keywords] of Object.entries(AGENT_INTENTS)) {
    counts[agent] = points.filter((p) => {
      const haystack = [
        p.payload?.strategic_intent || "",
        p.payload?.outcome || "",
        p.payload?.action_taken || "",
      ]
        .join(" ")
        .toUpperCase();
      return keywords.some((kw) => haystack.includes(kw));
    }).length;
  }

  // SUPERVISOR appears in every cycle
  counts["SUPERVISOR"] = total;

  // Always return all 5 agents so the table is never empty
  return Object.entries(counts).map(([name, decisions]) => ({
    name,
    decisions,
    accuracy: Math.min(
      100,
      Math.max(
        0,
        name === "SUPERVISOR"
          ? baseAccuracy
          : name === "JUDGE"
            ? Math.max(0, baseAccuracy - 2)
            : name === "DOCTOR"
              ? decisions > 0
                ? Math.round(baseAccuracy * 0.95)
                : 0
              : decisions > 0
                ? Math.min(100, baseAccuracy + 3)
                : 0,
      ),
    ),
  }));
};
