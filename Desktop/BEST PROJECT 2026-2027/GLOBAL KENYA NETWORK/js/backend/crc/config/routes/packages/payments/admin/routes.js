
const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { pool } = require("../config/database");

const router = express.Router();

// Validate the user's JWT.
function authenticateToken(req, res, next) {
  const [scheme, token] = (
    req.headers.authorization || ""
  ).split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET is not configured."));
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "global-network-kenya"
    });

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}

function validId(id) {
  return /^\d+$/.test(id);
}

// POST /api/payments
// Create a pending payment for an active package.
router.post("/", authenticateToken, async (req, res, next) => {
  try {
    const schema = z.object({
      package_id: z.coerce.number().int().positive(),
      phone: z.string().trim().regex(
        /^(?:\+254|254|0)7\d{8}$/,
        "Enter a valid Kenyan mobile number."
      )
    });

    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment details.",
        errors: parsed.error.issues
      });
    }

    const { package_id, phone } = parsed.data;

    const packageResult = await pool.query(
      `SELECT id, name, price, currency, duration_days, placement
       FROM packages
       WHERE id = $1 AND is_active = TRUE`,
      [package_id]
    );

    if (packageResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found or inactive."
      });
    }

    const selectedPackage = packageResult.rows[0];

    const paymentResult = await pool.query(
      `INSERT INTO payments
         (user_id, package_id, amount, currency, phone, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, user_id, package_id, amount,
                 currency, phone, status, created_at`,
      [
        req.user.sub,
        selectedPackage.id,
        selectedPackage.price,
        selectedPackage.currency,
        phone
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Pending payment created. Complete payment through the payment provider.",
      payment: paymentResult.rows[0],
      package: {
        name: selectedPackage.name,
        duration_days: selectedPackage.duration_days,
        placement: selectedPackage.placement
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/mine
// Users see their own payment history; admins see all payments.
router.get("/mine", authenticateToken, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";

    const result = await pool.query(
      `SELECT p.id, p.package_id, p.amount, p.currency,
              p.phone, p.status, p.provider_receipt,
              p.created_at, p.updated_at,
              pkg.name AS package_name
       FROM payments p
       JOIN packages pkg ON pkg.id = p.package_id
       WHERE ($1::boolean = TRUE OR p.user_id = $2)
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [isAdmin, req.user.sub]
    );

    return res.json({
      success: true,
      payments: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/:id
// Users can view their own payment; admins can view any payment.
router.get("/:id", authenticateToken, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID."
      });
    }

    const result = await pool.query(
      `SELECT p.id, p.package_id, p.amount, p.currency,
              p.phone, p.status, p.provider_receipt,
              p.created_at, p.updated_at,
              pkg.name AS package_name
       FROM payments p
       JOIN packages pkg ON pkg.id = p.package_id
       WHERE p.id = $1
         AND ($2::boolean = TRUE OR p.user_id = $3)`,
      [
        req.params.id,
        req.user.role === "admin",
        req.user.sub
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Payment not found."
      });
    }

    return res.json({
      success: true,
      payment: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/provider-confirmation
// Only a trusted server-side payment verifier may call this endpoint.
// Verify provider transactions before forwarding confirmation here.
router.post(
  "/provider-confirmation",
  async (req, res, next) => {
    try {
      const expectedSecret = process.env.PAYMENT_CALLBACK_SECRET;
      const suppliedSecret = req.get("x-payment-callback-secret");

      if (!expectedSecret) {
        return res.status(503).json({
          success: false,
          message: "Payment confirmation is not configured."
        });
      }

      if (
        typeof suppliedSecret !== "string" ||
        Buffer.byteLength(suppliedSecret) !==
          Buffer.byteLength(expectedSecret) ||
        !crypto.timingSafeEqual(
          Buffer.from(suppliedSecret),
          Buffer.from(expectedSecret)
        )
      ) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized payment confirmation."
        });
      }

      const schema = z.object({
        payment_id: z.coerce.number().int().positive(),
        status: z.enum(["successful", "failed"]),
        provider_receipt: z.string().trim().min(1).max(100).optional()
      });

      const parsed = schema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment confirmation."
        });
      }

      const {
        payment_id,
        status,
        provider_receipt
      } = parsed.data;

      const result = await pool.query(
        `UPDATE payments
         SET status = $1,
             provider_receipt = COALESCE($2, provider_receipt),
             updated_at = NOW()
         WHERE id = $3
           AND status IN ('pending', 'processing')
         RETURNING id, status, provider_receipt`,
        [status, provider_receipt || null, payment_id]
      );

      if (result.rowCount === 0) {
        return res.status(409).json({
          success: false,
          message: "Payment not found or already finalized."
        });
      }

      return res.json({
        success: true,
        message: "Payment status recorded.",
        payment: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
