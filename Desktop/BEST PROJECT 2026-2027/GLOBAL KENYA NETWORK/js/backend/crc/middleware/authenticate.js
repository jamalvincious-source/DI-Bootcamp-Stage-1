"use strict";

const jwt = require("jsonwebtoken");
const { prisma } = require("../config/database");

async function authenticateToken(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required. Please log in."
        });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is missing."
        });
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

    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(payload.sub) },
            select: {
                id: true,
                name: true,
                email: true,
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
        req.user = user;
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
