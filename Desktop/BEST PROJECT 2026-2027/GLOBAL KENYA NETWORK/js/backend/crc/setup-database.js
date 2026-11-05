
"use strict";

const path = require("path");

// Load the root .env file.
require("dotenv").config({
    path: path.resolve(__dirname, "../../../.env")
});

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Configure a PostgreSQL connection string in .env.");
}

// Configure PostgreSQL.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "require"
        ? { rejectUnauthorized: false }
        : undefined,

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// Monitor database connection errors.
pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error.message);
});

// Test database connection.
async function connectDatabase() {
    let client;

    try {
        client = await pool.connect();

        const result = await client.query(
            "SELECT current_database(), current_user"
        );

        console.log("PostgreSQL connected successfully.");
        console.log("Database:", result.rows[0].current_database);
        console.log("User:", result.rows[0].current_user);

        return result.rows[0];

    } catch (error) {
        console.error("Database connection failed:", error.message);
        throw error;

    } finally {
        if (client) {
            client.release();
        }
    }
}

// Close database connections.
async function closeDatabase() {
    await pool.end();
    console.log("PostgreSQL pool closed.");
}

// EXPORT FUNCTIONS FOR SERVER.JS
module.exports = {
    pool,
    connectDatabase,
    closeDatabase
};

if (require.main === module) {
    (async () => {
        try {
            await connectDatabase();
        } catch (error) {
            console.error("Database setup check failed:", error.message);
            process.exitCode = 1;
        } finally {
            await closeDatabase();
        }
    })().catch((error) => {
        console.error("Database setup cleanup failed:", error.message);
        process.exitCode = 1;
    });
}
``