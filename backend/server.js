const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

const frontendOrigin = 'https://afdossa.github.io';
const JWT_SECRET = 'your_super_secret_jwt_key';
const TOKEN_EXPIRATION = '30m';
const PORT = 5000;

const users = [];
let userIdCounter = 1;

const events = [
    { id: 1, name: "Movie Night", date: "2025-12-01", description: "Watching the latest blockbuster.", tickets_available: 50 },
    { id: 2, name: "Study Group", date: "2025-12-05", description: "Reviewing for the final exam.", tickets_available: 15 },
    { id: 3, name: "Hiking Trip", date: "2025-12-10", description: "Scenic hike at the state park.", tickets_available: 100 },
];

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

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', frontendOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

app.use(cookieParser());
app.use(express.json());

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

const purchaseEvent = (req, res) => {
    const eventId = req.params.id;
    return res.status(200).json({ message: `Event ${eventId} purchased successfully.` });
};

app.post('/api/register', register);
app.post('/api/login', login);
app.get('/api/events', getEvents);
app.post('/api/events/:id/purchase', protect, purchaseEvent);
app.post('/api/logout', logout);
app.get('/api/profile', protect, getProfile);

app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

const finalPort = process.env.PORT || PORT;

app.listen(finalPort, () => {
    console.log(`--- PORT DEBUG ---`);
    console.log(`Express Server STARTING on port: ${finalPort}`);
    console.log(`Raw process.env.PORT is: ${process.env.PORT}`);
    console.log(`Fallback PORT is: ${PORT}`);
    console.log(`------------------`);
});