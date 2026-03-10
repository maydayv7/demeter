export const formatNumber = (val) => {
  if (val === undefined || val === null || isNaN(parseFloat(val))) return "0";
  return Math.round(parseFloat(val) * 100) / 100;
};

export const parsePythonString = (str) => {
  if (!str) return null;
  if (typeof str === "object") return str;

  try {
    return JSON.parse(str);
  } catch (e) {
    try {
      // Fix Python single quotes and Booleans
      const fixedStr = str
        .replace(/'/g, '"')
        .replace(/\bNone\b/g, "null")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bTrue\b/g, "true");
      return JSON.parse(fixedStr);
    } catch (e2) {
      return null;
    }
  }
};

export const extractSensors = (payload) => {
  if (!payload) return { temp: 0, ph: 0, humidity: 0, ec: 0 };

  let rawSensors = payload.sensors || payload.sensor_data;

  // Fallback to extracting from action_taken if sensors are missing
  if (!rawSensors) {
    const actionData = parsePythonString(payload.action_taken);
    if (actionData) {
      rawSensors = {
        temp:
          actionData.atmospheric_actions?.air_temp ?? actionData.air_temp ?? 0,
        ph: actionData.water_actions?.ph ?? actionData.ph ?? 0,
        humidity:
          actionData.atmospheric_actions?.humidity ?? actionData.humidity ?? 0,
        ec: actionData.water_actions?.ec ?? actionData.ec ?? 0,
      };
    } else {
      rawSensors = {};
    }
  }

  // Safely extract and format prioritizing known variations of the keys
  return {
    temp: formatNumber(rawSensors.temp ?? rawSensors.air_temp ?? 0),
    ph: formatNumber(rawSensors.pH ?? rawSensors.ph ?? 7.0),
    humidity: formatNumber(rawSensors.humidity ?? 0),
    ec: formatNumber(rawSensors.EC ?? rawSensors.ec ?? 0),
  };
};

export const calculateMaturity = (seq) => {
  const val = (seq || 1) * 10;
  return val > 100 ? 100 : val;
};

export const formatOutcome = (outcome) => {
  if (!outcome || typeof outcome !== "string") return "Monitoring...";

  const parts = outcome.split("|").map((p) => p.trim());
  let tags = [];
  let notes = "";

  parts.forEach((part) => {
    if (part.startsWith("condition_assessed")) {
      const val = part.replace("condition_assessed", "").trim();
      if (val) tags.push(`Condition: ${val}`);
    } else if (part.startsWith("health_score:")) {
      const val = part.replace("health_score:", "").trim();
      if (val) tags.push(`Health Score: ${val}`);
    } else if (part.startsWith("notes:")) {
      notes = part.replace("notes:", "").trim();
    } else if (part) {
      tags.push(part);
    }
  });

  if (tags.length === 0 && !notes) {
    return outcome;
  }

  const tagsStr = tags.join(" • ");
  if (tagsStr && notes) {
    return `${tagsStr} - ${notes}`;
  }
  return tagsStr || notes;
};
