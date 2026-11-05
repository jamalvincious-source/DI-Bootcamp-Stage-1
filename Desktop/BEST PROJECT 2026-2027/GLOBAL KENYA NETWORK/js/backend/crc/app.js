"use strict";

const express = require("express");
const cors = require("cors");
const { prisma } = require("./config/database");
const authRoutes = require("./config/routes/auth/ruotes");
const businessRoutes = require("./config/routes/businesses/routes").router;
const advertRoutes = require("./config/routes/adverts/routes").router;
const listingRoutes = require("./config/routes/listings/routes").router;
const packageRoutes = require("./config/routes/packages/routes");
const paymentRoutes = require("./config/routes/packages/payments/routes");
const adminRoutes = require("./config/routes/admin/routes");

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return res.status(200).json({
            success: true,
            message: "API is healthy",
            status: "ok"
        });
    } catch (error) {
        console.error("API health check failed:", error.message);
        return res.status(503).json({
            success: false,
            message: "The database is unavailable.",
            status: "unavailable"
        });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/adverts", advertRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.use((error, _req, res, _next) => {
    console.error("Unhandled backend error:", error);

    const statusCode = Number(error?.statusCode || error?.status || 500);

    res.status(statusCode).json({
        success: false,
        message: error?.message || "Something went wrong on the server."
    });
});

module.exports = app;
