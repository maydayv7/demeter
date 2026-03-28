const CropStateSchema = require("../schema/cropSchema");

// HELPERS

/** Generates a fake sensor hardware ID */
function fakeSensorId(prefix) {
  const chars = "ABCDEF0123456789";
  const rand4 = () =>
    Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  return `${prefix}-SEN-${rand4()}`;
}

/** Auto cycle_duration_hours per crop type */
const CYCLE_HOURS = {
  lettuce: 1,
  basil: 1,
  tomato: 2,
  strawberry: 2,
};

function cycleDurationForCrop(cropName) {
  if (!cropName) return 1;
  return CYCLE_HOURS[cropName.toLowerCase()] || 1;
}

// CONTROLLERS

const createCrop = async (req, res) => {
  try {
    const { crop_id, crop, stage, location, notes, image_url, ...rest } =
      req.body;

    if (!crop_id) {
      return res.status(400).json({ error: "crop_id is required" });
    }

    const existingCrop = await CropStateSchema.findOne({ crop_id });
    if (existingCrop) {
      return res
        .status(409)
        .json({ error: "Crop with this ID already exists" });
    }

    const newCrop = new CropStateSchema({
      crop_id,
      crop,
      stage: stage || "seedling",
      sequence_number: 0,
      total_crop_lifetime_days: 0,
      planted_at: new Date(),
      last_updated: new Date(),

      // Auto-set initial sensor arrays
      sensors: {
        pH: [6.0],
        EC: [1.5],
        temp: [24.0],
        humidity: [60.0],
      },

      // Fallback to auto-generated fake sensor IDs
      sensor_ids: {
        ph_sensor: req.body.sensor_ids?.ph_sensor || fakeSensorId("PH"),
        ec_sensor: req.body.sensor_ids?.ec_sensor || fakeSensorId("EC"),
        temp_sensor: req.body.sensor_ids?.temp_sensor || fakeSensorId("TMP"),
        humidity_sensor:
          req.body.sensor_ids?.humidity_sensor || fakeSensorId("HUM"),
      },

      // Auto-set cycle_duration_hours based on crop type
      cycle_duration_hours: cycleDurationForCrop(crop),

      location: location || "",
      notes: notes || "",
      image_url: image_url || "",

      ...rest,
    });

    const savedCrop = await newCrop.save();

    res.status(201).json({
      message: "Crop created successfully",
      data: savedCrop,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllCrops = async (req, res) => {
  console.log("getAllCrops endpoint called");
  try {
    const crops = await CropStateSchema.find();
    console.log(`Retrieved ${crops.length} crops from the database.`);
    res.status(200).json({
      message: "Crops retrieved successfully",
      data: crops,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    console.log("getAllCrops endpoint was called");
  }
};

const getCropById = async (req, res) => {
  try {
    const { cropId } = req.params;
    const crop = await CropStateSchema.findOne({ crop_id: cropId });
    if (!crop) {
      return res.status(404).json({ error: "Crop not found" });
    }
    res.status(200).json({ data: crop });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateCrop = async (req, res) => {
  try {
    const { cropId } = req.params;
    const updates = { ...req.body, last_updated: new Date() };

    const updated = await CropStateSchema.findOneAndUpdate(
      { crop_id: cropId },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({ error: "Crop not found" });
    }
    res.status(200).json({ message: "Crop updated", data: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteCrop = async (req, res) => {
  try {
    const { cropId } = req.params;
    const deleted = await CropStateSchema.findOneAndDelete({ crop_id: cropId });
    if (!deleted) {
      return res.status(404).json({ error: "Crop not found" });
    }
    res.status(200).json({ message: "Crop deleted", data: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createCrop,
  getAllCrops,
  getCropById,
  updateCrop,
  deleteCrop,
};
