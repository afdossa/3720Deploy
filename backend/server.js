const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();

const frontendOrigin = 'https://afdossa.github.io';
const JWT_SECRET = 'your_super_secret_jwt_key';
const TOKEN_EXPIRATION = '30m';
const PORT = 5000;
const DB_FILE = path.join(__dirname, 'tiger_tix.db');
let db;

const initializeDB = async () => {
    try {
        db = await sqlite.open({
            filename: DB_FILE,
            driver: sqlite3.Database
        });

        await db.run(`
            CREATE TABLE IF NOT EXISTS users (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 email TEXT UNIQUE NOT NULL,
                                                 password TEXT NOT NULL
            );
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS events (
                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                  name TEXT NOT NULL,
                                                  date TEXT NOT NULL,
                                                  tickets_available INTEGER NOT NULL DEFAULT 0
            );
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS tickets (
                                                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                   user_id INTEGER NOT NULL,
                                                   event_id INTEGER NOT NULL,
                                                   purchase_date TEXT NOT NULL,
                                                   FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (event_id) REFERENCES events(id)
                );
        `);

        await db.run(`
            INSERT OR IGNORE INTO events (id, name, date, tickets_available) VALUES
            (1, 'Clemson Football Game', '2025-09-01', 100),
            (2, 'Campus Concert', '2025-09-10', 50),
            (3, 'Career Fair', '2025-09-15', 200);
        `);

        console.log('SQLite database initialized successfully.');

        const finalPort = process.env.PORT || PORT;
        app.listen(finalPort, () => {
            console.log('--- PORT DEBUG ---');
            console.log(`Express Server STARTING on port: ${finalPort}`);
            console.log(`Raw process.env.PORT is: ${process.env.PORT}`);
            console.log(`Fallback PORT is: ${PORT}`);
            console.log('------------------');
        });

    } catch (err) {
        console.error('Database initialization error:', err);
        process.exit(1);
    }
};

initializeDB();

const createAndSendToken = (user, res) => {
    const token = jwt.sign({ id: user.id }, JWT_SECRET, {
        expiresIn: TOKEN_EXPIRATION,
    });

    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 30 * 60 * 1000,
        sameSite: isProduction ? 'None' : 'Lax',
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
        const user = await db.get('SELECT id, email FROM users WHERE id = ?', [decoded.id]);

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

    try {
        const existingUser = await db.get('SELECT email FROM users WHERE email = ?', [email]);
        if (existingUser) return res.status(409).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
        const newUser = { id: result.lastID, email };

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

    const user = await db.get('SELECT id, email, password FROM users WHERE email = ?', [email]);
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

const getEvents = async (req, res) => {
    try {
        const events = await db.all('SELECT id, name, date, tickets_available FROM events');
        return res.status(200).json(events);
    } catch (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ message: 'Error retrieving events from database' });
    }
};

const getMyEvents = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required to view tickets.' });
    }
    const userId = req.user.id;
    try {
        const myTickets = await db.all(`
            SELECT
                t.id AS ticket_id,
                e.id,
                e.name,
                e.date
            FROM tickets t
                     JOIN events e ON t.event_id = e.id
            WHERE t.user_id = ?
            ORDER BY e.date DESC
        `, [userId]);

        return res.status(200).json(myTickets);
    } catch (err) {
        console.error('Error fetching user tickets:', err);
        return res.status(500).json({ message: 'Error retrieving user tickets from database' });
    }
};

const purchaseEvent = async (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id;

    await db.run('BEGIN TRANSACTION');
    try {
        const event = await db.get('SELECT id, name, tickets_available FROM events WHERE id = ?', [eventId]);

        if (!event) {
            await db.run('ROLLBACK');
            return res.status(404).json({ message: 'Event not found.' });
        }
        if (event.tickets_available <= 0) {
            await db.run('ROLLBACK');
            return res.status(400).json({ message: 'Tickets sold out.' });
        }

        await db.run('UPDATE events SET tickets_available = tickets_available - 1 WHERE id = ?', [eventId]);

        await db.run(
            'INSERT INTO tickets (user_id, event_id, purchase_date) VALUES (?, ?, ?)',
            [userId, eventId, new Date().toISOString()]
        );

        await db.run('COMMIT');

        const updatedTickets = event.tickets_available - 1;

        return res.status(200).json({
            message: `Event ${event.name} purchased successfully. Remaining: ${updatedTickets}`
        });
    } catch (err) {
        await db.run('ROLLBACK');
        console.error('Purchase error:', err);
        return res.status(500).json({ message: 'Server error during purchase.' });
    }
};

app.post('/api/register', register);
app.post('/api/login', login);
app.get('/api/events', getEvents);
app.get('/api/my-events', protect, getMyEvents);
app.post('/api/events/:id/purchase', protect, purchaseEvent);
app.post('/api/logout', logout);
app.get('/api/profile', protect, getProfile);

app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});