// ============================================================
// DEMETER MOCK DATA
// Set USE_MOCK_DATA = true to use local test data
// Set USE_MOCK_DATA = false to connect to the real backend API
// ============================================================
export const USE_MOCK_DATA = true;

// HELPERS
const ts = (daysAgo, hour = 10, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

// Dashboard snapshots (latest per crop)
export const MOCK_DASHBOARD = [
  {
    id: "pt-001",
    payload: {
      crop_id: "Batch_Lettuce_2025A",
      crop: "Lettuce",
      stage: "Vegetative",
      sequence_number: 14,
      timestamp: ts(0, 9, 30),
      sensors: { pH: 6.1, EC: 1.4, temp: 23.5, humidity: 68 },
      action_taken: JSON.stringify({
        acid_dosage_ml: 0,
        base_dosage_ml: 0,
        nutrient_dosage_ml: 2.5,
        fan_speed_pct: 45,
        water_refill_l: 0,
      }),
      outcome: "IMPROVED | Reward: 0.8",
      strategic_intent: "MAINTAIN_CURRENT",
      bandit_action_id: 0,
      reward_score: 0.8,
    },
  },
  {
    id: "pt-002",
    payload: {
      crop_id: "Batch_Tomato_2025B",
      crop: "Tomato",
      stage: "Flowering",
      sequence_number: 22,
      timestamp: ts(0, 8, 15),
      sensors: { pH: 5.8, EC: 2.1, temp: 26.0, humidity: 58 },
      action_taken: JSON.stringify({
        acid_dosage_ml: 1.5,
        base_dosage_ml: 0,
        nutrient_dosage_ml: 4.0,
        fan_speed_pct: 60,
        water_refill_l: 0,
      }),
      outcome: "STABLE | Reward: 0.4",
      strategic_intent: "INCREASE_EC_BLOOM",
      bandit_action_id: 6,
      reward_score: 0.4,
    },
  },
  {
    id: "pt-003",
    payload: {
      crop_id: "Batch_Basil_2025C",
      crop: "Basil",
      stage: "Seedling",
      sequence_number: 5,
      timestamp: ts(0, 11, 0),
      sensors: { pH: 7.8, EC: 0.6, temp: 29.5, humidity: 82 },
      action_taken: JSON.stringify({
        acid_dosage_ml: 8.0,
        base_dosage_ml: 0,
        nutrient_dosage_ml: 3.0,
        fan_speed_pct: 80,
        water_refill_l: 0,
      }),
      outcome: "DETERIORATED | Reward: -0.6",
      strategic_intent: "AGGRESSIVE_PH_DOWN",
      bandit_action_id: 2,
      reward_score: -0.6,
    },
  },
  {
    id: "pt-004",
    payload: {
      crop_id: "Batch_Spinach_2025D",
      crop: "Spinach",
      stage: "Vegetative",
      sequence_number: 9,
      timestamp: ts(1, 14, 45),
      sensors: { pH: 6.3, EC: 1.6, temp: 21.0, humidity: 72 },
      action_taken: JSON.stringify({
        acid_dosage_ml: 0,
        base_dosage_ml: 0,
        nutrient_dosage_ml: 1.0,
        fan_speed_pct: 35,
        water_refill_l: 2.0,
      }),
      outcome: "IMPROVED | Reward: 0.7",
      strategic_intent: "GENTLE_PH_BALANCING",
      bandit_action_id: 4,
      reward_score: 0.7,
    },
  },
  {
    id: "pt-005",
    payload: {
      crop_id: "Batch_Cucumber_2025E",
      crop: "Cucumber",
      stage: "Fruiting",
      sequence_number: 31,
      timestamp: ts(0, 7, 0),
      sensors: { pH: 5.5, EC: 2.8, temp: 27.5, humidity: 55 },
      action_taken: JSON.stringify({
        acid_dosage_ml: 0,
        base_dosage_ml: 2.0,
        nutrient_dosage_ml: 0,
        fan_speed_pct: 70,
        water_refill_l: 5.0,
      }),
      outcome: "STABLE | Reward: 0.3",
      strategic_intent: "LOWER_EC_FLUSH",
      bandit_action_id: 7,
      reward_score: 0.3,
    },
  },
];

// Detailed history per crop (multiple snapshots)
function makeHistory(cropId, cropName, stage, n, baseVals) {
  return Array.from({ length: n }, (_, i) => {
    const jitter = (range) => (Math.random() - 0.5) * range;
    return {
      id: `${cropId}-seq-${i + 1}`,
      payload: {
        crop_id: cropId,
        crop: cropName,
        stage,
        sequence_number: i + 1,
        timestamp: ts(Math.floor((n - i) / 3), (i * 2) % 24, (i * 7) % 60),
        sensors: {
          pH: +(baseVals.ph + jitter(0.4)).toFixed(2),
          EC: +(baseVals.ec + jitter(0.3)).toFixed(2),
          temp: +(baseVals.temp + jitter(2)).toFixed(1),
          humidity: +(baseVals.humidity + jitter(8)).toFixed(1),
        },
        action_taken: JSON.stringify({
          acid_dosage_ml: +(Math.random() * 3).toFixed(1),
          base_dosage_ml: +(Math.random() * 2).toFixed(1),
          nutrient_dosage_ml: +(Math.random() * 5).toFixed(1),
          fan_speed_pct: +(30 + Math.random() * 50).toFixed(0),
          water_refill_l: +(Math.random() * 4).toFixed(1),
        }),
        outcome:
          i % 5 === 0
            ? "DETERIORATED | Reward: -0.4"
            : i % 3 === 0
              ? "STABLE | Reward: 0.3"
              : "IMPROVED | Reward: 0.75",
        strategic_intent: [
          "MAINTAIN_CURRENT",
          "GENTLE_PH_BALANCING",
          "INCREASE_EC_VEG",
          "RAISE_TEMP_HUMIDITY",
          "MAX_AIR_CIRCULATION",
        ][i % 5],
        reward_score: i % 5 === 0 ? -0.4 : i % 3 === 0 ? 0.3 : 0.75,
      },
    };
  });
}

export const MOCK_HISTORY = [
  ...makeHistory("Batch_Lettuce_2025A", "Lettuce", "Vegetative", 14, {
    ph: 6.1,
    ec: 1.4,
    temp: 23.5,
    humidity: 68,
  }),
  ...makeHistory("Batch_Tomato_2025B", "Tomato", "Flowering", 22, {
    ph: 5.9,
    ec: 2.0,
    temp: 26.0,
    humidity: 58,
  }),
  ...makeHistory("Batch_Basil_2025C", "Basil", "Seedling", 5, {
    ph: 7.2,
    ec: 0.7,
    temp: 29.0,
    humidity: 80,
  }),
  ...makeHistory("Batch_Spinach_2025D", "Spinach", "Vegetative", 9, {
    ph: 6.3,
    ec: 1.6,
    temp: 21.5,
    humidity: 72,
  }),
  ...makeHistory("Batch_Cucumber_2025E", "Cucumber", "Fruiting", 31, {
    ph: 5.6,
    ec: 2.7,
    temp: 27.0,
    humidity: 56,
  }),
];

// Mock search / agent response
export const MOCK_SEARCH_RESULT = {
  status: "success",
  new_fmu_id: "mock-fmu-001",
  agent_decision: {
    acid_dosage_ml: 2.5,
    base_dosage_ml: 0,
    nutrient_dosage_ml: 3.0,
    fan_speed_pct: 55,
    water_refill_l: 1.5,
  },
  explanation: `1. **Observation**: Sensors show pH 6.2, EC 1.4 dS/m, Temp 23.5°C, Humidity 68%.
    All parameters are within acceptable range for Vegetative Lettuce.

2. **Precedent**: 3 similar past states found. In 2 of those cases, a slight EC boost
   improved growth rate. No disease was detected in the last 5 cycles.

3. **Logic**: EC at 1.4 is slightly below the 1.5–1.8 target for late vegetative.
   A small nutrient dosage increase will push it into the optimal window.
   Fan speed is adequate; no VPD concerns.

4. **Conclusion**: Dosing 3.0ml nutrients is the safest, most targeted intervention.
   No pH correction needed. Maintain current atmospheric settings.`,
  search_results: MOCK_DASHBOARD.slice(0, 3).map((d, i) => ({
    id: d.id,
    score: 0.95 - i * 0.08,
    payload: d.payload,
  })),
};
