require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');

const COLLECTION_NAME = 'Farm_Memory';

// 1. Initialize Client with the Fix
const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    checkCompatibility: false, // 👈 FIX: Skips the failing version check
});

// 2. Indexing & Collection Setup Function
const initDB = async () => {
    try {
        // Test connection first
        // If this fails, check your QDRANT_URL in .env
        const result = await client.getCollections();
        
        const exists = result.collections.some(c => c.name === COLLECTION_NAME);

        // A. Create Collection if missing
        if (!exists) {
            await client.createCollection(COLLECTION_NAME, {
                vectors: { size: 4, distance: 'Cosine' }, 
            });
            console.log(`✅ Collection '${COLLECTION_NAME}' created.`);
        }

        // B. Create Index
        // Using try-catch here specifically for index creation to prevent crashing if it already exists
        try {
            await client.createPayloadIndex(COLLECTION_NAME, {
                field_name: "crop_id",
                field_schema: "keyword", 
            });
            console.log("✅ Indexes verified.");
        } catch (indexError) {
            // Ignore error if index already exists
            if (!indexError.message.includes("already exists")) {
                console.warn("⚠️ Note on Index:", indexError.message);
            }
        }

    } catch (err) {
        console.error("❌ DB Connection Failed:");
        console.error("   Reason:", err.message);
        console.error("   Check your QDRANT_URL in .env. It must start with 'http://' or 'https://'");
    }
};

module.exports = { client, initDB, COLLECTION_NAME };