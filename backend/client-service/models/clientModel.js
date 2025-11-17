const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

// Load database file from shared-db
const dbPath = path.join(__dirname, "../../shared-db/database.sqlite");
const initScriptPath = path.join(__dirname, "../../shared-db/init.sql");

let db; // will hold the in-memory SQL.js database

async function initializeDatabase() {
    const SQL = await initSqlJs();

    // load existing file or create new
    let fileBuffer;
    if (fs.existsSync(dbPath)) {
        fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Run init.sql every startup (it only creates tables if missing)
    const initSQL = fs.readFileSync(initScriptPath, "utf8");
    db.run(initSQL);

    // Save DB back to file
    saveDatabase();
    console.log("Database initialized successfully");
}

function saveDatabase() {
    const data = Buffer.from(db.export());
    fs.writeFileSync(dbPath, data);
}

/**
 * Fetch all events
 */
function getEvents() {
    try {
        const stmt = db.prepare("SELECT id, name, date, tickets_available FROM events");
        const rows = [];

        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }

        stmt.free();
        return rows;
    } catch (err) {
        console.error("getEvents error:", err);
        throw err;
    }
}

/**
 * Purchase a ticket (transaction simulated)
 */
function purchaseTicket(eventId) {
    try {
        // Check available tickets
        const check = db.prepare("SELECT tickets_available FROM events WHERE id = ?");
        check.bind([eventId]);
        check.step();
        const row = check.getAsObject();
        check.free();

        if (!row || row.tickets_available <= 0) {
            console.log("No tickets available");
            return false;
        }

        // Reduce ticket count
        db.run("UPDATE events SET tickets_available = tickets_available - 1 WHERE id = ?", [eventId]);

        // Save file
        saveDatabase();

        console.log(`Ticket purchased for event ${eventId}`);
        return true;
    } catch (err) {
        console.error("purchaseTicket error:", err);
        throw err;
    }
}

module.exports = { initializeDatabase, getEvents, purchaseTicket };
