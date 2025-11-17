const express = require('express');
const cors = require('cors');
const app = express();
const routes = require('./routes/clientRoutes');

/**
 * Express server configuration for Client Service
 * Handles event browsing and ticket purchasing functionality
 */

// Middleware configuration
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', routes);

// Server initialization
const PORT = process.env.PORT || 6001;   // <-- REQUIRED FOR RENDER

app.listen(PORT, () => {
    console.log(`Client service running on port ${PORT}`);
});
