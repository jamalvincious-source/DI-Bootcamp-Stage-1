
 
/* =========================================
   1. NOT FOUND HANDLER
========================================= */

function notFoundHandler(req, res, next) {
    const error = new Error(
        `Route not found: ${req.method} ${req.originalUrl}`
    );

    error.statusCode = 404;
    next(error);
}

/* =========================================
   2. MAP DATABASE ERRORS
========================================= */

function mapDatabaseError(error) {
    switch (error.code) {
        case "23505": // Unique constraint violation
            return {
                statusCode: 409,
                message: "A record with this information already exists."
            };

        case "23503": // Foreign key violation
            return {
                statusCode: 400,
                message: "The related record does not exist or cannot be removed."
            };

        case "23502": // Not-null violation
            return {
                statusCode: 400,
                message: "A required database field is missing."
            };

        case "23514": // Check constraint violation
            return {
                statusCode: 400,
                message: "The submitted information violates a data rule."
            };

        case "22P02": // Invalid text representation
            return {
                statusCode: 400,
                message: "A submitted value has an invalid format."
            };

        case "42P01": // Undefined table
            console.error("PostgreSQL table is missing:", error.message);
            return {
                statusCode: 500,
                message: "A database configuration error occurred."
            };

        default:
            return null;
    }
}

/* =========================================
   3. CENTRAL ERROR HANDLER
========================================= */

function errorHandler(err, req, res, next) {
    // Allow Express to handle errors after headers are sent.
    if (res.headersSent) {
        return next(err);
    }

    const isProduction = process.env.NODE_ENV === "production";

    let statusCode = 500;
    let message = "An unexpected error occurred.";

    /*
     * Handle malformed JSON and oversized request bodies.
     */
    if (err.type === "entity.parse.failed") {
        statusCode = 400;
        message = "Invalid JSON in the request body.";
    } else if (err.type === "entity.too.large") {
        statusCode = 413;
        message = "The request body is too large.";
    } else if (err.name === "ZodError") {
        statusCode = 400;
        message = "Please check the submitted information.";
    } else {
        /*
         * Handle known database errors.
         */
        const databaseError = mapDatabaseError(err);

        if (databaseError) {
            statusCode = databaseError.statusCode;
            message = databaseError.message;
        } else {
            /*
             * Handle ordinary application and HTTP errors.
             */
            const candidateStatus = Number(
                err.statusCode || err.status
            );

            if (
                Number.isInteger(candidateStatus) &&
                candidateStatus >= 400 &&
                candidateStatus <= 599
            ) {
                statusCode = candidateStatus;
                message = err.message || message;
            } else if (!isProduction && err.message) {
                message = err.message;
            }
        }
    }

    /*
     * Ensure unexpected server errors stay generic in production.
     */
    if (isProduction && statusCode >= 500) {
        message = "Internal server error.";
    }

    /*
     * Log server errors for debugging.
     */
    if (statusCode >= 500) {
        console.error("Global Network Kenya server error:", {
            method: req.method,
            path: req.originalUrl,
            message: err.message,
            code: err.code
        });

        if (!isProduction && err.stack) {
            console.error(err.stack);
        }
    }

    /*
     * Build a consistent API response.
     */
    const response = {
        success: false,
        message
    };

    /*
     * Include field-level details for Zod validation errors.
     */
    if (err.name === "ZodError" && Array.isArray(err.issues)) {
        response.errors = err.issues.map(issue => ({
            field: issue.path.join("."),
            message: issue.message
        }));
    }

    /*
     * Expose stack traces only during local development.
     */
    if (!isProduction && statusCode >= 500 && err.stack) {
        response.stack = err.stack;
    }

    return res.status(statusCode).json(response);
}

/* =========================================
   4. EXPORT MIDDLEWARE
========================================= */

module.exports = {
    notFoundHandler,
    errorHandler
};
``