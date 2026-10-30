"use strict";

require("dotenv").config();

const bcrypt = require("bcrypt");
const { z } = require("zod");
const app = require("./app");
const { connectDatabase, prisma } = require("./config/database");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "localhost";
const BCRYPT_ROUNDS = 12;

const superAdminSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(12).refine(
        password => Buffer.byteLength(password, "utf8") <= 72,
        "Password must not exceed 72 UTF-8 bytes."
    )
});

async function provisionSuperAdmin() {
    const config = {
        name: process.env.SUPER_ADMIN_NAME,
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD || undefined
    };

    if (!config.name && !config.email && !config.password) {
        console.warn("Super-admin account not provisioned. Configure SUPER_ADMIN_NAME and SUPER_ADMIN_EMAIL.");
        return;
    }

    if (!config.name || !config.email) {
        throw new Error("Set SUPER_ADMIN_NAME and SUPER_ADMIN_EMAIL together.");
    }

    const parsed = superAdminSchema.safeParse(config);

    if (!parsed.success) {
        const details = parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ");
        throw new Error(`Invalid super-admin configuration: ${details}`);
    }

    const { name } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);

    await prisma.$transaction(async transaction => {
        const user = await transaction.user.upsert({
            where: { email },
            create: {
                name,
                email,
                passwordHash,
                role: "super_admin"
            },
            update: {
                name,
                passwordHash,
                role: "super_admin"
            },
            select: { id: true }
        });

        await transaction.user.updateMany({
            where: {
                role: "super_admin",
                id: { not: user.id }
            },
            data: { role: "user" }
        });
    });

    console.log("Super-admin account provisioned from server configuration.");
}

async function startServer() {
    try {
        await connectDatabase();
        await provisionSuperAdmin();

        const server = app.listen(PORT, HOST, () => {
            console.log("--------------------------------------------");
            console.log(" Global Network Kenya API");
            console.log("--------------------------------------------");
            console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
            console.log(`Server:      http://${HOST}:${PORT}`);
            console.log(`Health:      http://${HOST}:${PORT}/api/health`);
            console.log("Database:    Prisma connected");
            console.log("--------------------------------------------");
        });

        const shutdown = async signal => {
            console.log(`\n${signal} received. Shutting down...`);

            try {
                await new Promise((resolve, reject) => {
                    server.close(error => (error ? reject(error) : resolve()));
                });

                console.log("HTTP server closed.");
            } finally {
                await prisma.$disconnect();
                console.log("Prisma disconnected.");
            }
        };

        process.once("SIGINT", () => {
            void shutdown("SIGINT");
        });

        process.once("SIGTERM", () => {
            void shutdown("SIGTERM");
        });
    } catch (error) {
        console.error("Failed to start Global Network Kenya.");
        console.error("Reason:", error.message);
        console.error("Check your DATABASE_URL and JWT_SECRET values.");

        await prisma.$disconnect().catch(() => {});
        process.exitCode = 1;
    }
}

process.on("unhandledRejection", reason => {
    console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", error => {
    console.error("Uncaught exception:", error);
    process.exit(1);
});

void startServer();
