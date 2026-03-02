const { randomUUID: uuidv4 } = require('crypto'); // ✅ Use built-in Node module
const { client, COLLECTION_NAME } = require('../config/db');

// --- LOGIC: Create New Memory ---
const addMemory = async (req, res) => {
    try {
        const { timestamp, sensors, metadata, crop_id, sequence_number, action_taken, outcome } = req.body;

        // Mock Vector (Replace with real embedding model in production)
        const vector = Array.from({ length: 4 }, () => Math.random());

        const payload = {
            timestamp: timestamp || new Date().toISOString(),
            sensors,
            ...metadata,
            crop_id: crop_id || "UNKNOWN_CROP",
            sequence_number: sequence_number || 1,
            action_taken: action_taken || "PENDING_ACTION",
            outcome: outcome || "PENDING_OBSERVATION"
        };

        const pointId = uuidv4();

        await client.upsert(COLLECTION_NAME, {
            points: [{
                id: pointId,
                vector: vector,
                payload: payload
            }]
        });

        res.json({ success: true, id: pointId, message: "Memory stored successfully" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// --- LOGIC: Dashboard (Unique crops + Latest State) ---
const getDashboard = async (req, res) => {
    try {
        const latestCropsMap = new Map();
        let nextOffset = null;
        let keepFetching = true;

        // Scroll through all data
        while (keepFetching) {
            const result = await client.scroll(COLLECTION_NAME, {
                limit: 100,
                with_payload: true,
                with_vector: false, // Save bandwidth
                offset: nextOffset,
            });

            // "Group By" Logic in JavaScript
            for (const point of result.points) {
                const p = point.payload;
                const cropId = p.crop_id;
                const seq = p.sequence_number || 0;

                // Check if we have this crop, or if this point is "newer" (higher sequence)
                if (!latestCropsMap.has(cropId)) {
                    latestCropsMap.set(cropId, point);
                } else {
                    const currentMax = latestCropsMap.get(cropId).payload.sequence_number || 0;
                    if (seq > currentMax) {
                        latestCropsMap.set(cropId, point);
                    }
                }
            }

            nextOffset = result.next_page_offset;
            if (!nextOffset) keepFetching = false;
        }

        const data = Array.from(latestCropsMap.values());
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message+"adfasdfads" });
    }
};

// --- LOGIC: Get History for One Crop ---
const getCropHistory = async (req, res) => {
    try {
        const { cropId } = req.params;
        
        // This filter is fast because we added the Index in db.js
        const result = await client.scroll(COLLECTION_NAME, {
            filter: {
                must: [{ key: "crop_id", match: { value: cropId } }]
            },
            limit: 1000, 
            with_payload: true,
            with_vector: false
        });

        // Sort Descending by Sequence Number
        const sorted = result.points.sort((a, b) => 
            (b.payload.sequence_number || 0) - (a.payload.sequence_number || 0)
        );

        res.json(sorted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = { addMemory, getDashboard, getCropHistory };