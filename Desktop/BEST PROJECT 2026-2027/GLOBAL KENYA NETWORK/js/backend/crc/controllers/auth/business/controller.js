
const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { pool } = require("../config/database");

const router = express.Router();

const businessSchema = z.object({
  name: z.string().trim().min(2).max(150),
  category: z.string().trim().min(2).max(80),
  county: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(25),
  description: z.string().trim().min(10).max(3000),
  image_url: z.string().trim().url().max(2048).optional().nullable()
});

const updateBusinessSchema = businessSchema.partial();

function authenticateToken(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  const secret = process.env.JWT_SECRET;

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue."
    });
  }

  if (!secret) {
    return next(new Error("JWT_SECRET is not configured."));
  }

  try {
    req.user = jwt.verify(token, secret, {
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

function validateBusinessInput(schema, req, res) {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Please check the business details you submitted.",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
    return null;
  }

  return result.data;
}

// GET /api/businesses
// Public business directory with search and filters.
router.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);
    const category = String(req.query.category || "").trim().slice(0, 80);
    const county = String(req.query.county || "").trim().slice(0, 100);

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12)
    );
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT id, name, category, county, phone, description,
              image_url, created_at
       FROM businesses
       WHERE status = 'published'
         AND ($1 = '' OR name ILIKE '%' || $1 || '%'
              OR description ILIKE '%' || $1 || '%')
         AND ($2 = '' OR category ILIKE $2)
         AND ($3 = '' OR county ILIKE $3)
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [search, category, county, limit, offset]
    );

    res.json({
      success: true,
      page,
      limit,
      businesses: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/businesses/:id
// Publicly view a published business.
router.get("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid business ID."
      });
    }

    const result = await pool.query(
      `SELECT id, name, category, county, phone, description,
              image_url, created_at
       FROM businesses
       WHERE id = $1 AND status = 'published'`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Business not found."
      });
    }

    res.json({
      success: true,
      business: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/businesses
// Authenticated users can submit a business listing.
router.post("/", authenticateToken, async (req, res, next) => {
  try {
    const data = validateBusinessInput(
      businessSchema,
      req,
      res
    );

    if (!data) return;

    const result = await pool.query(
      `INSERT INTO businesses
         (owner_id, name, category, county, phone,
          description, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id, owner_id, name, category, county, phone,
                 description, image_url, status, created_at`,
      [
        req.user.sub,
        data.name,
        data.category,
        data.county,
        data.phone,
        data.description,
        data.image_url || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Business submitted for review.",
      business: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/businesses/:id
// Owners can edit their own listings; admins can edit any listing.
router.patch("/:id", authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid business ID."
      });
    }

    const data = validateBusinessInput(
      updateBusinessSchema,
      req,
      res
    );

    if (!data) return;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update."
      });
    }

    const allowedFields = [
      "name",
      "category",
      "county",
      "phone",
      "description",
      "image_url"
    ];

    const fields = Object.keys(data).filter((key) =>
      allowedFields.includes(key)
    );

    const values = fields.map((field) => data[field] ?? null);

    const setClause = fields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(", ");

    values.push(id);
    const idPosition = values.length;
    values.push(req.user.sub);
    const ownerPosition = values.length;

    const isAdmin = req.user.role === "admin";

    const query = `
      UPDATE businesses
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${idPosition}
        ${isAdmin ? "" : `AND owner_id = $${ownerPosition}`}
      RETURNING id, owner_id, name, category, county, phone,
                description, image_url, status, updated_at
    `;

    const result = await pool.query(
      query,
      isAdmin ? values.slice(0, idPosition) : values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Business not found or you cannot edit it."
      });
    }

    res.json({
      success: true,
      message: "Business updated successfully.",
      business: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/businesses/:id
// Owners can delete their own listings; admins can delete any listing.
router.delete("/:id", authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid business ID."
      });
    }

    const isAdmin = req.user.role === "admin";

    const result = await pool.query(
      `DELETE FROM businesses
       WHERE id = $1
         AND ($2::boolean = TRUE OR owner_id = $3)
       RETURNING id`,
      [id, isAdmin, req.user.sub]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Business not found or you cannot delete it."
      });
    }

    res.json({
      success: true,
      message: "Business deleted successfully."
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
