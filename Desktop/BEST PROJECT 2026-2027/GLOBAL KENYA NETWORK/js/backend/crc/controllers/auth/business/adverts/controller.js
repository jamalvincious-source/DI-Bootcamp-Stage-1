
const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { pool } = require("../config/database");

const router = express.Router();

const advertSchema = z.object({
  business_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(3000),
  image_url: z.string().trim().url().max(2048).nullable().optional(),
  target_url: z.string().trim().url().max(2048).nullable().optional(),
  placement: z.enum(["standard", "featured", "banner"]).default("standard")
});

const updateAdvertSchema = advertSchema
  .omit({ business_id: true })
  .partial();

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
      message: "Invalid advert details.",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });

    return null;
  }

  return result.data;
}

// GET /api/adverts
// Public: list active adverts.
router.get("/", async (req, res, next) => {
  try {
    const placement = req.query.placement
      ? String(req.query.placement)
      : "";

    if (
      placement &&
      !["standard", "featured", "banner"].includes(placement)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid advert placement."
      });
    }

    const result = await pool.query(
      `SELECT a.id, a.business_id, a.title, a.description,
              a.image_url, a.target_url, a.placement,
              a.starts_at, a.ends_at, a.created_at,
              b.name AS business_name, b.county
       FROM adverts a
       JOIN businesses b ON b.id = a.business_id
       WHERE a.status = 'approved'
         AND b.status = 'published'
         AND a.starts_at <= NOW()
         AND (a.ends_at IS NULL OR a.ends_at > NOW())
         AND ($1 = '' OR a.placement = $1)
       ORDER BY
         CASE a.placement
           WHEN 'banner' THEN 1
           WHEN 'featured' THEN 2
           ELSE 3
         END,
         a.created_at DESC
       LIMIT 50`,
      [placement]
    );

    res.json({
      success: true,
      adverts: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/adverts/mine
// Authenticated: list adverts for businesses owned by the user.
router.get("/mine", authenticateToken, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin";

    const result = await pool.query(
      `SELECT a.*, b.name AS business_name
       FROM adverts a
       JOIN businesses b ON b.id = a.business_id
       WHERE ($1::boolean = TRUE OR b.owner_id = $2)
       ORDER BY a.created_at DESC`,
      [isAdmin, req.user.sub]
    );

    res.json({
      success: true,
      adverts: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/adverts
// Submit an advert for review.
router.post("/", authenticateToken, async (req, res, next) => {
  try {
    const data = validate(advertSchema, req, res);
    if (!data) return;

    // Only the business owner or an administrator may advertise it.
    const business = await pool.query(
      `SELECT id
       FROM businesses
       WHERE id = $1
         AND status = 'published'
         AND ($2::boolean = TRUE OR owner_id = $3)`,
      [
        data.business_id,
        req.user.role === "admin",
        req.user.sub
      ]
    );

    if (business.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Published business not found or access denied."
      });
    }

    const result = await pool.query(
      `INSERT INTO adverts
         (business_id, title, description, image_url,
          target_url, placement, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        data.business_id,
        data.title,
        data.description,
        data.image_url || null,
        data.target_url || null,
        data.placement
      ]
    );

    res.status(201).json({
      success: true,
      message: "Advert submitted for approval.",
      advert: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/adverts/:id
// Owner may edit their advert; an admin may edit any advert.
// Owner edits return the advert to pending review.
router.patch("/:id", authenticateToken, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advert ID."
      });
    }

    const data = validate(updateAdvertSchema, req, res);
    if (!data) return;

    const fields = Object.keys(data);

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update."
      });
    }

    const allowed = [
      "title",
      "description",
      "image_url",
      "target_url",
      "placement"
    ];

    const values = [];
    const assignments = fields
      .filter((field) => allowed.includes(field))
      .map((field) => {
        values.push(data[field] ?? null);
        return `${field} = $${values.length}`;
      });

    if (assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update."
      });
    }

    // Owners cannot keep an advert approved after editing it.
    if (req.user.role !== "admin") {
      assignments.push("status = 'pending'");
    }

    assignments.push("updated_at = NOW()");
    values.push(req.params.id);
    const idPosition = values.length;
    values.push(req.user.sub);
    const ownerPosition = values.length;

    const isAdmin = req.user.role === "admin";

    const result = await pool.query(
      `UPDATE adverts a
       SET ${assignments.join(", ")}
       WHERE a.id = $${idPosition}
         AND (
           $${ownerPosition}::boolean = TRUE
           OR EXISTS (
             SELECT 1 FROM businesses b
             WHERE b.id = a.business_id
               AND b.owner_id = $${ownerPosition + 1}
           )
         )
       RETURNING a.*`,
      isAdmin
        ? [...values.slice(0, idPosition), true, req.user.sub]
        : [...values.slice(0, idPosition), false, req.user.sub]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Advert not found or access denied."
      });
    }

    res.json({
      success: true,
      message: "Advert updated successfully.",
      advert: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/adverts/:id/review
// Only administrators can approve or reject an advert.
router.patch(
  "/:id/review",
  authenticateToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid advert ID."
        });
      }

      const schema = z.object({
        status: z.enum(["approved", "rejected"])
      });

      const parsed = schema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Status must be approved or rejected."
        });
      }

      const result = await pool.query(
        `UPDATE adverts
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [parsed.data.status, req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Advert not found."
        });
      }

      res.json({
        success: true,
        message: `Advert ${parsed.data.status}.`,
        advert: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/adverts/:id
// Owners can remove their own adverts; admins can remove any advert.
router.delete("/:id", authenticateToken, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advert ID."
      });
    }

    const isAdmin = req.user.role === "admin";

    const result = await pool.query(
      `DELETE FROM adverts a
       WHERE a.id = $1
         AND (
           $2::boolean = TRUE
           OR EXISTS (
             SELECT 1 FROM businesses b
             WHERE b.id = a.business_id
               AND b.owner_id = $3
           )
         )
       RETURNING a.id`,
      [req.params.id, isAdmin, req.user.sub]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Advert not found or access denied."
      });
    }

    res.json({
      success: true,
      message: "Advert deleted successfully."
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
