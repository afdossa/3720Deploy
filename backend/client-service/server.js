const express = require('express');
const cors = require('cors');
const app = express();
const routes = require('./routes/clientRoutes');

const { initializeDatabase } = require('./models/clientModel');
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

// Port (Render requires process.env.PORT)
const PORT = process.env.PORT || 6001;

app.listen(PORT, () => {
    console.log(`Client service running on port ${PORT}`);
});
