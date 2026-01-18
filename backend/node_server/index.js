const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/db');
const farmRoutes = require('./routes/farmRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Initialize Database & Indexes
initDB();

// Mount Routes
// All routes inside farmRoutes will be prefixed with /api
app.use('/api', farmRoutes); 

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});