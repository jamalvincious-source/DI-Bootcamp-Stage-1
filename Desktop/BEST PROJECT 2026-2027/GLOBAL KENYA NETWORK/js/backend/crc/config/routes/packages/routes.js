
const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { pool } = require("../config/database");

const router = express.Router();

const packageSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(1000),
  price: z.number().finite().min(0).max(100000000),
  duration_days: z.number().int().min(1).max(3650),
  placement: z.enum(["standard", "featured", "banner"]),
  is_active: z.boolean().optional().default(true)
});

const updatePackageSchema = packageSchema.partial();

function authenticateToken(req, res, next) {
  const [scheme, token] = (
    req.headers.authorization || ""
  ).split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue."
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

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Administrator access is required."
    });
  }

  next();
}

function validate(schema, req, res) {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid package details.",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });

    return null;
  }

  return result.data;
}

// GET /api/packages
// Public: show active advertising packages.
router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, price,
              currency, duration_days, placement, created_at
       FROM packages
       WHERE is_active = TRUE
       ORDER BY price ASC, duration_days ASC`
    );

    res.json({
      success: true,
      packages: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/packages/:id
// Public: show one active package.
router.get("/:id", async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID."
      });
    }

    const result = await pool.query(
      `SELECT id, name, description, price,
              currency, duration_days, placement, created_at
       FROM packages
       WHERE id = $1 AND is_active = TRUE`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found."
      });
    }

    res.json({
      success: true,
      package: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/packages
// Admin only: create a package.
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const data = validate(packageSchema, req, res);
      if (!data) return;

      const result = await pool.query(
        `INSERT INTO packages
           (name, description, price, duration_days,
            placement, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.name,
          data.description,
          data.price,
          data.duration_days,
          data.placement,
          data.is_active
        ]
      );

      res.status(201).json({
        success: true,
        message: "Package created successfully.",
        package: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/packages/:id
// Admin only: update a package.
router.patch(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid package ID."
        });
      }

      const data = validate(updatePackageSchema, req, res);
      if (!data) return;

      const fields = Object.keys(data);

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Provide at least one field to update."
        });
      }

      const values = fields.map((field) => data[field]);

      const assignments = fields.map(
        (field, index) => `${field} = $${index + 1}`
      );

      assignments.push("updated_at = NOW()");
      values.push(req.params.id);

      const result = await pool.query(
        `UPDATE packages
         SET ${assignments.join(", ")}
         WHERE id = $${values.length}
         RETURNING *`,
        values
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Package not found."
        });
      }

      res.json({
        success: true,
        message: "Package updated successfully.",
        package: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/packages/:id
// Admin only: deactivate instead of permanently deleting.
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid package ID."
        });
      }

      const result = await pool.query(
        `UPDATE packages
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, is_active`,
        [req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Package not found."
        });
      }

      res.json({
        success: true,
        message: "Package deactivated successfully.",
        package: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
