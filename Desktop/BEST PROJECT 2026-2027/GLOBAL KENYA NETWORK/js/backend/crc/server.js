
"use strict";

const path = require("path");

// Load environment variables from project root
require("dotenv").config({
    path: path.resolve(__dirname, "../../../.env")
});

const http = require("http");
const bcrypt = require("bcrypt");
const app = require("./app");
const {
    prisma,
    connectDatabase,
    disconnectDatabase
} = require("./config/database");

// Server configuration
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const BCRYPT_ROUNDS = 12;

let server;
let isShuttingDown = false;

// Validate environment configuration
function validateEnvironment() {
    const requiredVariables = ["DATABASE_URL"];

    const missingVariables = requiredVariables.filter(
        (variable) => !process.env[variable]
    );

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing environment variables: ${missingVariables.join(", ")}`
        );
    }

    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        throw new Error("Invalid PORT configuration.");
    }
}

async function provisionSuperAdmin() {
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email && !password) return;
    if (!email || !password) {
        throw new Error("Set both SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to configure the Super Admin account.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("SUPER_ADMIN_EMAIL must be a valid email address.");
    }
    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
        throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters and no more than 72 UTF-8 bytes.");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

    await prisma.user.upsert({
        where: { email },
        create: {
            name,
            email,
            passwordHash,
            role: "super_admin",
            isActive: true
        },
        update: {
            name,
            passwordHash,
            role: "super_admin",
            isActive: true
        }
    });

    console.log("Configured Super Admin account is ready.");
}

// Start the HTTP server only after database connection succeeds
async function startServer() {
    try {
        validateEnvironment();

        await connectDatabase();
        await provisionSuperAdmin();

        server = http.createServer(app);

        server.listen(PORT, HOST, () => {
            console.log("-------------------------------------");
            console.log(" GLOBAL NETWORK KENYA BACKEND");
            console.log("-------------------------------------");
            console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
            console.log(`Server: http://${HOST}:${PORT}`);
            console.log(`API: http://${HOST}:${PORT}/api`);
            console.log(`Health: http://${HOST}:${PORT}/api/health`);
            console.log("Database: Connected");
            console.log("-------------------------------------");
        });

        server.on("error", (error) => {
            console.error("HTTP server error:", error);
            process.exitCode = 1;
        });

    } catch (error) {
        console.error("SERVER STARTUP FAILED:", error.message);

        await closeDatabase();

        process.exitCode = 1;
    }
}

// Close database connection safely
async function closeDatabase() {
    try {
        await disconnectDatabase();
        console.log("Database connection closed.");
    } catch (error) {
        console.error("Database shutdown error:", error.message);
    }
}

// Graceful shutdown
async function shutdown(signal) {
    if (isShuttingDown) return;

    isShuttingDown = true;

    console.log(`\n${signal} received. Shutting down...`);

    if (server) {
        server.close(async (error) => {
            if (error) {
                console.error("HTTP shutdown error:", error);
                process.exitCode = 1;
            }

            await closeDatabase();
            process.exit();
        });

        // Prevent new connections
        server.closeIdleConnections?.();

    } else {
        await closeDatabase();
        process.exit();
    }
}

// Operating system shutdown signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Unexpected application errors
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Promise Rejection:", reason);
    shutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    shutdown("UNCAUGHT_EXCEPTION");
});

// Start application
startServer();
``