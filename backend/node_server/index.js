const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const express = require("express");
const cors = require("cors");
const { initDB, connectMongoDB } = require("./config/db");
const farmRoutes = require("./routes/farmRoutes");
const cropRoutes = require("./routes/cropRoutes");

const dns = require("node:dns/promises");
dns.setServers(["1.1.1.1"]);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Initialize Database & Indexes
initDB();
connectMongoDB();

// Mount Routes
// All routes inside farmRoutes will be prefixed with /api
app.use("/api", farmRoutes);
app.use("/api/crops", cropRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
