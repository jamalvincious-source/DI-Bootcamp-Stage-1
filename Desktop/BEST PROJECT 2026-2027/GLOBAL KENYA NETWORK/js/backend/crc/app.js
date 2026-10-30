"use strict";

const express = require("express");
const cors = require("cors");
const authRoutes = require("./config/routes/auth/ruotes");
const adminRoutes = require("./config/routes/admin/routes");

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", async (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API is healthy",
        status: "ok"
    });
});

app.use("/api/auth", authRoutes);
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
