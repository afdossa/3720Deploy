const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Connect to shared SQLite DB
const dbPath = path.join(__dirname, '../../shared-db/database.sqlite');
const db = new Database(dbPath);

// Initialize database (runs .sql script once)
const initScript = fs.readFileSync(
    path.join(__dirname, '../../shared-db/init.sql'),
    'utf8'
);

try {
    db.exec(initScript);
    console.log("Database initialized successfully");
} catch (err) {
    console.error("Database initialization failed:", err);
}

/**
 * Fetches all events from SQLite database
 * @returns {Array} Array of event objects
 */
const getEvents = () => {
    try {
        const stmt = db.prepare("SELECT id, name, date, tickets_available FROM events");
        const rows = stmt.all();
        console.log(`Fetched ${rows.length} events from database`);
        return rows;
    } catch (err) {
        console.error("Database error in getEvents:", err);
        throw err;
    }
};

/**
 * Purchases a ticket using a safe transaction
 * @param {number} eventId
 * @returns {boolean} True if purchase succeeded
 */
const purchaseTicket = (eventId) => {
    try {
        const purchaseTransaction = db.transaction((id) => {
            const stmt = db.prepare(`
                UPDATE events
                SET tickets_available = tickets_available - 1
                WHERE id = ? AND tickets_available > 0
            `);

            const result = stmt.run(id);
            return result.changes > 0;
        });

        const success = purchaseTransaction(eventId);

        if (success) {
            console.log(`Ticket purchased for event ${eventId}`);
        } else {
            console.log(`No tickets available for event ${eventId}`);
        }

        return success;
    } catch (err) {
        console.error("Database error in purchaseTicket:", err);
        throw err;
    }
};

module.exports = { getEvents, purchaseTicket };
