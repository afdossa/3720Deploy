const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// --- CONFIGURATION ---
const frontendOrigin = 'https://afdossa.github.io';
const JWT_SECRET = 'your_super_secret_jwt_key'; // CHANGE THIS
const TOKEN_EXPIRATION = '30m';
const PORT = 5000; // Local fallback port

// --- IN-MEMORY USER STORAGE (Temporary - Replace with DB model!) ---
const users = [];
let userIdCounter = 1;
// ------------------------------------------

// --- IN-MEMORY EVENT STORAGE (Temporary) ---
const events = [
    { id: 1, title: "Movie Night", date: "2025-12-01", description: "Watching the latest blockbuster." },
    { id: 2, title: "Study Group", date: "2025-12-05", description: "Reviewing for the final exam." },
    { id: 3, title: "Hiking Trip", date: "2025-12-10", description: "Scenic hike at the state park." },
];
// ------------------------------------------

// --- HELPER FUNCTION: JWT Cookie Generation ---
const createAndSendToken = (user, res) => {
    const token = jwt.sign({ id: user.id }, JWT_SECRET, {
        expiresIn: TOKEN_EXPIRATION,
    });

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 60 * 1000,
        sameSite: 'Lax',
    });
};

// =======================================================
// --- CRITICAL MANUAL CORS OVERRIDE MIDDLEWARE (AND PREFLIGHT FIX) ---
// This section is placed first to ensure the critical headers are always set.
// =======================================================
app.use((req, res, next) => {
    // 1. MUST be the specific origin for credentials: 'include'
    res.header('Access-Control-Allow-Origin', frontendOrigin);
    // 2. MUST be true for cookies/credentials
    res.header('Access-Control-Allow-Credentials', 'true');
    // 3. Allowed methods
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    // 4. Allowed headers
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests (OPTIONS method) explicitly and immediately
    if (req.method === 'OPTIONS') {
        // End the request here with the 200 status code
        return res.sendStatus(200);
    }

    next();
});

// These must be defined AFTER the CORS middleware
app.use(cookieParser());
app.use(express.json());

// =======================================================
// --- AUTHENTICATION MIDDLEWARE: protect() ---
// =======================================================
const protect = async (req, res, next) => {
    const token = req.cookies.jwt;
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated. No token found.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = users.find(u => u.id === decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User belonging to this token no longer exists.' });
        }
        req.user = { id: user.id, email: user.email };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
        console.error("JWT verification error:", err);
        return res.status(401).json({ message: 'Not authorized, token failed.' });
    }
};

// =======================================================
// --- CONTROLLER LOGIC ---
// =======================================================
const register = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    if (users.find(u => u.email === email)) return res.status(409).json({ message: 'User already exists' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: userIdCounter++, email, password: hashedPassword };
        users.push(newUser);
        createAndSendToken(newUser, res);
        return res.status(201).json({
            message: 'User registered successfully',
            user: { id: newUser.id, email: newUser.email }
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ message: 'Server error during registration' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
        createAndSendToken(user, res);
        return res.status(200).json({
            message: 'Login successful',
            user: { id: user.id, email: user.email }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Server error during login' });
    }
};

const logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        httpOnly: true,
        expires: new Date(Date.now() + 10 * 1000),
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
    });
    res.status(200).json({ message: 'Logout successful' });
};

const getProfile = (req, res) => {
    res.status(200).json({
        message: 'Session verified',
        user: req.user
    });
};

const getEvents = (req, res) => {
    return res.status(200).json(events);
};

// --- NEW CONTROLLER: Event Purchase (Add this) ---
const purchaseEvent = (req, res) => {
    const eventId = req.params.id;
    // In a real app, you would verify the user (via req.user) and update the database
    // For this in-memory example, we just return success
    return res.status(200).json({ message: `Event ${eventId} purchased successfully.` });
};

// =======================================================
// --- ROUTE DEFINITIONS ---
// =======================================================

// Public routes
app.post('/api/register', register);
app.post('/api/login', login);

// Event routes
app.get('/api/events', getEvents);
// NEW ROUTE: Fixes the 404 for event purchasing (Add this)
app.post('/api/events/:id/purchase', protect, purchaseEvent);

app.post('/api/logout', logout);

// Protected route
app.get('/api/profile', protect, getProfile);

// --- SERVER START (FIXED PORT USAGE) ---
const finalPort = process.env.PORT || PORT;

app.listen(finalPort, () => console.log(`Server running on port ${finalPort}`));