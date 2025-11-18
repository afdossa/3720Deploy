// server.js (Single-File Backend Solution)

const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// --- CONFIGURATION ---
// Set this to your frontend domain to resolve the CORS error
const frontendOrigin = 'https://afdossa.github.io';
const JWT_SECRET = 'your_super_secret_jwt_key'; // Use a strong, environment variable in production!
const TOKEN_EXPIRATION = '30m';
const PORT = 5000;

// --- IN-MEMORY USER STORAGE (Replace with DB model) ---
// This is temporary and will be reset every time the server restarts.
const users = [];
let userIdCounter = 1;
// -----------------------------------------------------------------------

// --- HELPER FUNCTION: JWT Cookie Generation ---
const createAndSendToken = (user, res) => {
    // 1. Create the JWT
    const token = jwt.sign({ id: user.id }, JWT_SECRET, {
        expiresIn: TOKEN_EXPIRATION,
    });

    // 2. Set the JWT as an HTTP-only cookie (secure storage)
    res.cookie('jwt', token, {
        httpOnly: true, // Prevents client-side JS access (security!)
        secure: process.env.NODE_ENV === 'production', // Only send over HTTPS (Render uses HTTPS)
        maxAge: 30 * 60 * 1000, // 30 minutes in milliseconds
        sameSite: 'Lax', // Required for cross-site cookie transmission
    });
};

// =======================================================
// --- MIDDLEWARE: Global Setup ---
// =======================================================
const corsOptions = {
    origin: frontendOrigin, // Specific origin fix
    credentials: true,      // Allows cookies (JWTs) to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply middleware
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json()); // Parses incoming JSON requests

// =======================================================
// --- AUTHENTICATION MIDDLEWARE: protect() ---
// Used to secure routes like /profile and /events/:id/purchase
// =======================================================
const protect = async (req, res, next) => {
    const token = req.cookies.jwt;

    if (!token) {
        return res.status(401).json({ message: 'Not authenticated. Please log in.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Find the user based on the decoded ID (In-memory mock lookup)
        const user = users.find(u => u.id === decoded.id);

        if (!user) {
            return res.status(401).json({ message: 'User belonging to this token no longer exists.' });
        }

        // Attach user info to the request object (available to the next function/controller)
        req.user = { id: user.id, email: user.email };
        next();
    } catch (err) {
        // Handle expired token or invalid signature
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

// POST /api/register
const register = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    if (users.find(u => u.email === email)) {
        return res.status(409).json({ message: 'User already exists' });
    }

    try {
        // Hashing the password using bcryptjs
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: userIdCounter++,
            email,
            password: hashedPassword,
        };
        users.push(newUser); // Save to temporary storage

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

// POST /api/login
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    try {
        // Compare password with hashed version
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

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

// POST /api/logout
const logout = (req, res) => {
    // Clears the cookie by setting an expired cookie value
    res.cookie('jwt', 'loggedout', {
        httpOnly: true,
        expires: new Date(Date.now() + 10 * 1000),
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
    });

    res.status(200).json({ message: 'Logout successful' });
};

// GET /api/profile (Protected Route)
const getProfile = (req, res) => {
    // Returns user data if the 'protect' middleware passed
    res.status(200).json({
        message: 'Session verified',
        user: req.user
    });
};

// --- EVENT ROUTE MOCK (Example of a public/unprotected route) ---
const events = [
    { id: 1, name: 'Football: Clemson vs USC', date: '2025-11-30', tickets_available: 50, price: 50 },
    { id: 2, name: 'Campus Orchestra Concert', date: '2025-12-10', tickets_available: 100, price: 15 },
    { id: 3, name: 'Student Film Festival', date: '2025-12-15', tickets_available: 15, price: 5 },
];

app.get('/api/events', (req, res) => {
    res.status(200).json(events);
});

// --- PROTECTED PURCHASE ROUTE MOCK ---
app.post('/api/events/:id/purchase', protect, (req, res) => {
    const eventId = parseInt(req.params.id);
    const event = events.find(e => e.id === eventId);

    if (!event) {
        return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.tickets_available <= 0) {
        return res.status(400).json({ message: 'Tickets are sold out.' });
    }

    // Process the purchase for the authenticated user
    event.tickets_available -= 1;

    console.log(`User ${req.user.email} purchased a ticket for ${event.name}`);

    res.status(200).json({
        message: 'Ticket purchased successfully!',
        user: req.user,
        tickets_left: event.tickets_available
    });
});

// =======================================================
// --- ROUTE DEFINITIONS ---
// =======================================================

// Public Authentication Routes
app.post('/api/register', register);
app.post('/api/login', login);
app.post('/api/logout', logout);

// Protected Authentication Route (used by frontend to check session)
app.get('/api/profile', protect, getProfile);

// Public Events Route
app.get('/api/events', (req, res) => res.status(200).json(events));

// Protected Purchase Route
app.post('/api/events/:id/purchase', protect, (req, res) => {
    // Purchase logic is defined above
    res.status(200).json({ message: 'Purchase route handler completed.' });
});


// --- SERVER START ---
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));