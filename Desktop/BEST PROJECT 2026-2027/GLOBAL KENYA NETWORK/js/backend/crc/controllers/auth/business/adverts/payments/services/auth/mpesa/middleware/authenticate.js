```javascript
"use strict";

const jwt = require("jsonwebtoken");

const JWT_ISSUER = "global-network-kenya";
const JWT_AUDIENCE = "global-network-kenya-users";

const ALLOWED_ROLES = ["user", "advertiser", "admin"];

/* =========================================
   VERIFY AUTHENTICATION TOKEN
========================================= */

function verifyToken(token) {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
        const error = new Error(
            "Authentication is not configured correctly."
        );

        error.status = 500;
        throw error;
    }

    const payload = jwt.verify(token, secret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ["HS256"]
    });

    const id = Number(payload.sub);

    if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !ALLOWED_ROLES.includes(payload.role)
    ) {
        const error = new Error("Invalid authentication token.");
        error.status = 401;
        throw error;
    }

    return {
        id,
        role: payload.role
    };
}

/* =========================================
   AUTHENTICATE USER
   Use for protected routes
========================================= */

function authenticateToken(req, res, next) {
    const authorization = req.headers.authorization;

    if (
        !authorization ||
        !authorization.startsWith("Bearer ")
    ) {
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

    try {
        req.user = verifyToken(token);
        return next();
    } catch (error) {
        if (error.status === 500) {
            console.error(error.message);

            return res.status(500).json({
                success: false,
                message: "Authentication service is unavailable."
            });
        }

        return res.status(401).json({
            success: false,
            message: "Your token is invalid or has expired."
        });
    }
}

/* =========================================
   OPTIONAL AUTHENTICATION
   Public routes with optional login
========================================= */

function optionalAuthenticateToken(req, res, next) {
    const authorization = req.headers.authorization;

    // Continue as a guest when no token is supplied.
    if (!authorization) {
        req.user = null;
        return next();
    }

    if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Invalid authorization header."
        });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is missing."
        });
    }

    try {
        req.user = verifyToken(token);
        return next();
    } catch (error) {
        if (error.status === 500) {
            console.error(error.message);

            return res.status(500).json({
                success: false,
                message: "Authentication service is unavailable."
            });
        }

        return res.status(401).json({
            success: false,
            message: "Your token is invalid or has expired."
        });
    }
}

/* =========================================
   ROLE-BASED AUTHORIZATION
========================================= */

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Please log in first."
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action."
            });
        }

        return next();
    };
}

/* =========================================
   ADMIN-ONLY ACCESS
========================================= */

const requireAdmin = requireRole("admin");

/* =========================================
   ADVERTISER OR ADMIN ACCESS
========================================= */

const requireAdvertiser = requireRole("advertiser", "admin");

/* =========================================
   EXPORT MIDDLEWARE
========================================= */

module.exports = {
    authenticateToken,
    optionalAuthenticateToken,
    requireRole,
    requireAdmin,
    requireAdvertiser
};
```