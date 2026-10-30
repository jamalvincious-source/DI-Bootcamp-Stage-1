```javascript
"use strict";

/**
 * Checks whether the logged-in user has permission
 * to access a route.
 *
 * This middleware must run AFTER authenticateToken.
 */

function authorizeRoles(...allowedRoles) {
    return function (req, res, next) {
        // Make sure the user is authenticated.
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Please log in to continue."
            });
        }

        // Make sure the role is permitted.
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to access this resource."
            });
        }

        return next();
    };
}

/**
 * Administrators only.
 */
const requireAdmin = authorizeRoles("admin");

/**
 * Advertisers and administrators.
 */
const requireAdvertiserOrAdmin = authorizeRoles(
    "advertiser",
    "admin"
);

/**
 * Any authenticated account role.
 */
const requireAnyUser = authorizeRoles(
    "user",
    "advertiser",
    "admin"
);

module.exports = {
    authorizeRoles,
    requireAdmin,
    requireAdvertiserOrAdmin,
    requireAnyUser
};
```