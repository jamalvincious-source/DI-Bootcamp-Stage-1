"use strict";

const jwt = require("jsonwebtoken");
const { prisma } = require("../config/database");
const { getAuthToken } = require("../config/auth-cookie");

async function authenticateToken(req, res, next) {
    const token = getAuthToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication required. Please log in."
        });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        return next(new Error("JWT_SECRET must be configured with at least 32 characters."));
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET, {
            issuer: "global-network-kenya",
            audience: "global-network-kenya-users"
        });
    } catch {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid or has expired. Please log in again."
        });
    }

    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId < 1) {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid or has expired. Please log in again."
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "This account is unavailable. Please contact support."
            });
        }

        req.auth = payload;
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt
        };
        return next();
    } catch (error) {
        return next(error);
    }
}

function requireSuperAdmin(req, res, next) {
    if (req.user?.role !== "super_admin") {
        return res.status(403).json({
            success: false,
            message: "Super-admin permission is required."
        });
    }

    return next();
}

module.exports = { authenticateToken, requireSuperAdmin };
