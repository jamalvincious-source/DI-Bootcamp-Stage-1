"use strict";

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});

async function connectDatabase() {
    await prisma.$connect();
    console.log("Prisma connected successfully.");
    return prisma;
}

module.exports = {
    prisma,
    connectDatabase
};
