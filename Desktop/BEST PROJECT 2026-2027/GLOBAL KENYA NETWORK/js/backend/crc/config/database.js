"use strict";

const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../../../../.env")
});

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Configure a PostgreSQL connection string in .env.");
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function connectDatabase() {
    await prisma.$connect();
    console.log("Prisma connected to PostgreSQL successfully.");
    return prisma;
}

module.exports = {
    prisma,
    connectDatabase,
    disconnectDatabase: () => prisma.$disconnect()
};
