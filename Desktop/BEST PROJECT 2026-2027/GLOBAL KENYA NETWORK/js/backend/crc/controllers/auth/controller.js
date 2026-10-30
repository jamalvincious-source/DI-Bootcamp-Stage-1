
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { pool } = require("../config/database");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().regex(/^(?:\+254|254|0)7\d{8}$/, {
    message: "Enter a valid Kenyan mobile number."
  }),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72)
});

function createToken(user) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    { sub: String(user.id), role: user.role },
    secret,
    { expiresIn: "2h", issuer: "global-network-kenya" }
  );
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid name, email, and password."
      });
    }

    const name = parsed.data.name;
    const email = parsed.data.email.toLowerCase();
    const phone = parsed.data.phone;
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, phone, role, created_at`,
      [name, email, phone, passwordHash]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const user = result.rows[0];

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email and password."
      });
    }

    const email = parsed.data.email.toLowerCase();

    const result = await pool.query(
      `SELECT id, name, email, phone, password_hash, role
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(
      parsed.data.password,
      user.password_hash
    ))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get("/me", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const [scheme, token] = (authHeader || "").split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required."
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured.");
    }

    let payload;

    try {
      payload = jwt.verify(token, secret, {
        issuer: "global-network-kenya"
      });
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token."
      });
    }

    const result = await pool.query(
      `SELECT id, name, email, phone, role, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [payload.sub]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "User account not found."
      });
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
