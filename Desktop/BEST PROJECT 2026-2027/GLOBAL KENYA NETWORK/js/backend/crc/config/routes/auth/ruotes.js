"use strict";

const express = require("express");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { createHash, randomBytes, randomInt } = require("crypto");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { prisma } = require("../../database");
const { authenticateToken } = require("../../../middleware/authenticate");
const { clearAuthCookie, sessionLifetime, setAuthCookie } = require("../../auth-cookie");

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_DELAY_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestTimestamps = new Map();

const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().regex(/^(?:\+254|254|0)7\d{8}$/).optional(),
    password: z.string().min(8).max(72),
    role: z.enum(["user", "advertiser"]).optional().default("user")
});

const loginSchema = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(72),
    rememberMe: z.boolean().optional().default(false)
});

const requestCodeSchema = z.object({
    email: z.string().trim().email().max(254)
});

const verifyCodeSchema = z.object({
    email: z.string().trim().email().max(254),
    code: z.string().regex(/^\d{6}$/)
});
const resetPasswordSchema = z.object({
    token: z.string().trim().min(32).max(256),
    password: z.string().min(8).max(72).refine(
        password => Buffer.byteLength(password, "utf8") <= 72,
        "Password must not exceed 72 UTF-8 bytes."
    )
});

function isRateLimited(key) {
    const now = Date.now();
    if (requestTimestamps.size > 10000) {
        for (const [storedKey, timestamps] of requestTimestamps) {
            const active = timestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
            if (active.length) {
                requestTimestamps.set(storedKey, active);
            } else {
                requestTimestamps.delete(storedKey);
            }
        }
    }

    const recent = (requestTimestamps.get(key) || []).filter(
        timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
        requestTimestamps.set(key, recent);
        return true;
    }

    recent.push(now);
    requestTimestamps.set(key, recent);
    return false;
}

function createMailTransporter() {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER || process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM || user;

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 ||
        !user || !password || !from) {
        throw new Error("Configure SUPER_ADMIN_EMAIL and SMTP_PASSWORD. SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_FROM can override the Gmail defaults.");
    }

    return {
        from,
        transporter: nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass: password }
        })
    };
}

function toPublicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        createdAt: user.createdAt ?? user.created_at
    };
}

function createToken(user, rememberMe = false) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET must be configured with at least 32 characters.");
    }

    return jwt.sign(
        {
            sub: String(user.id),
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: sessionLifetime(rememberMe),
            issuer: "global-network-kenya",
            audience: "global-network-kenya-users"
        }
    );
}

router.post("/register", async (req, res, next) => {
    try {
        const parsed = registerSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Please check your registration details.",
                errors: parsed.error.issues.map(issue => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            });
        }

        const email = parsed.data.email.toLowerCase();

        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
            throw new Error("JWT_SECRET must be configured with at least 32 characters.");
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                name: parsed.data.name.trim(),
                email,
                phone: parsed.data.phone || "",
                passwordHash,
                role: parsed.data.role
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true
            }
        });

        const token = createToken(user);
        setAuthCookie(res, token);

        return res.status(201).json({
            success: true,
            message: "Your account has been created successfully.",
            user: toPublicUser(user)
        });
    } catch (error) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        next(error);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const parsed = loginSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email and password."
            });
        }

        const email = parsed.data.email.toLowerCase();
        const userRecord = await prisma.user.findUnique({
            where: { email }
        });

        if (!userRecord) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordMatches = await bcrypt.compare(parsed.data.password, userRecord.passwordHash);

        if (!passwordMatches || !userRecord.isActive) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = toPublicUser(userRecord);
        const token = createToken(user, parsed.data.rememberMe);
        setAuthCookie(res, token, parsed.data.rememberMe);

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            expiresIn: sessionLifetime(parsed.data.rememberMe),
            user
        });
    } catch (error) {
        next(error);
    }
});

router.post("/logout", (_req, res) => {
    clearAuthCookie(res);
    return res.status(200).json({
        success: true,
        message: "You have been logged out."
    });
});

router.post("/forgot-password", async (req, res, next) => {
    const parsed = requestCodeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Enter a valid account email address." });
    }

    const email = parsed.data.email.toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(`password-reset:${ip}`) || isRateLimited(`password-reset-email:${email}`)) {
        return res.status(429).json({
            success: false,
            message: "Too many password reset requests. Please wait before trying again."
        });
    }

    let mail;
    let resetUrl;
    try {
        mail = createMailTransporter();
        const frontendBaseUrl = new URL(process.env.FRONTEND_BASE_URL);
        if (!["http:", "https:"].includes(frontendBaseUrl.protocol)) {
            throw new Error("FRONTEND_BASE_URL must use HTTP or HTTPS.");
        }
        resetUrl = new URL("/pages/reset-password.html", frontendBaseUrl).toString();
    } catch (error) {
        console.error("Password reset email is not configured:", error.message);
        return res.status(503).json({
            success: false,
            message: "Password reset is temporarily unavailable. Contact the site administrator."
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, isActive: true }
        });
        if (!user || !user.isActive) {
            return res.status(202).json({
                success: true,
                message: "If an active account uses that email, password reset instructions will be sent."
            });
        }

        const token = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.passwordResetToken.upsert({
            where: { userId: user.id },
            create: { userId: user.id, tokenHash, expiresAt },
            update: { tokenHash, expiresAt, createdAt: new Date() }
        });

        const link = new URL(resetUrl);
        link.searchParams.set("token", token);
        try {
            await mail.transporter.sendMail({
                from: mail.from,
                to: email,
                subject: "Reset your Global Network Kenya password",
                text: `Use this link to reset your password within 30 minutes: ${link.toString()}\n\nIf you did not request this, ignore this email.`,
                html: `<p>Use the link below to reset your password within 30 minutes.</p><p><a href="${link.toString()}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`
            });
        } catch (error) {
            await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, tokenHash } });
            console.error("Failed to deliver a password reset email:", error.message);
            return res.status(503).json({
                success: false,
                message: "Could not send password reset instructions. Check the email service configuration and try again."
            });
        }

        return res.status(202).json({
            success: true,
            message: "If an active account uses that email, password reset instructions will be sent."
        });
    } catch (error) {
        return next(error);
    }
});

router.post("/reset-password", async (req, res, next) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid reset link and a password of at least 8 characters."
        });
    }

    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    try {
        const resetRecord = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            select: { id: true, userId: true }
        });
        if (!resetRecord) {
            return res.status(400).json({ success: false, message: "This password reset link is invalid or has expired." });
        }

        const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
        await prisma.$transaction(async transaction => {
            const consumed = await transaction.passwordResetToken.deleteMany({
                where: { id: resetRecord.id, tokenHash, expiresAt: { gt: new Date() } }
            });
            if (consumed.count !== 1) {
                const error = new Error("This password reset link is invalid or has expired.");
                error.statusCode = 400;
                throw error;
            }
            await transaction.user.update({
                where: { id: resetRecord.userId },
                data: { passwordHash }
            });
        });
        return res.json({ success: true, message: "Your password has been reset. You can now sign in." });
    } catch (error) {
        if (error?.statusCode === 400) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error?.code === "P2025") {
            return res.status(400).json({ success: false, message: "This password reset link is invalid or has expired." });
        }
        return next(error);
    }
});

router.post("/admin/request-code", async (req, res, next) => {
    const parsed = requestCodeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid email address."
        });
    }

    const email = parsed.data.email.toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(`request:${ip}`) || isRateLimited(`email:${email}`)) {
        return res.status(429).json({
            success: false,
            message: "Too many code requests. Please wait before trying again."
        });
    }

    let mail;
    try {
        mail = createMailTransporter();
    } catch (error) {
        console.error("Super Admin email sign-in is not configured:", error.message);
        return res.status(503).json({
            success: false,
            message: "Super Admin email sign-in is temporarily unavailable. Contact the site administrator."
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, role: true, isActive: true }
        });

        if (!user || user.role !== "super_admin" || !user.isActive) {
            return res.status(202).json({
                success: true,
                message: "If this email belongs to an active Super Admin, a sign-in code will be sent."
            });
        }

        const existingChallenge = await prisma.superAdminLoginChallenge.findUnique({
            where: { userId: user.id }
        });
        if (existingChallenge && Date.now() - existingChallenge.createdAt.getTime() < CODE_RESEND_DELAY_MS) {
            return res.status(202).json({
                success: true,
                message: "If this email belongs to an active Super Admin, a sign-in code will be sent."
            });
        }

        const code = String(randomInt(100000, 1000000));
        const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
        const expiresAt = new Date(Date.now() + CODE_TTL_MS);
        await prisma.superAdminLoginChallenge.upsert({
            where: { userId: user.id },
            create: { userId: user.id, codeHash, expiresAt, attempts: 0 },
            update: { codeHash, expiresAt, attempts: 0, createdAt: new Date() }
        });

        try {
            await mail.transporter.sendMail({
                from: mail.from,
                to: email,
                subject: "Your Global Network Kenya Super Admin sign-in code",
                text: `Your Super Admin sign-in code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
                html: `<p>Your Super Admin sign-in code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`
            });
        } catch (error) {
            await prisma.superAdminLoginChallenge.deleteMany({
                where: { userId: user.id, codeHash }
            });
            console.error("Failed to deliver Super Admin sign-in code:", error.message);
            return res.status(503).json({
                success: false,
                message: "Could not send the sign-in code. Check the email service configuration and try again."
            });
        }

        return res.status(202).json({
            success: true,
            message: "If this email belongs to an active Super Admin, a sign-in code will be sent."
        });
    } catch (error) {
        return next(error);
    }
});

router.post("/admin/verify-code", async (req, res, next) => {
    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid email address and six-digit sign-in code."
        });
    }

    const email = parsed.data.email.toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(`verify:${ip}`)) {
        return res.status(429).json({
            success: false,
            message: "Too many verification attempts. Please wait before trying again."
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        });
        if (!user || user.role !== "super_admin" || !user.isActive) {
            return res.status(401).json({ success: false, message: "Invalid or expired sign-in code." });
        }

        const initialChallenge = await prisma.superAdminLoginChallenge.findUnique({
            where: { userId: user.id }
        });
        if (!initialChallenge || initialChallenge.expiresAt.getTime() <= Date.now()) {
            if (initialChallenge) {
                await prisma.superAdminLoginChallenge.deleteMany({ where: { id: initialChallenge.id } });
            }
            return res.status(401).json({ success: false, message: "Invalid or expired sign-in code." });
        }

        const attempt = await prisma.superAdminLoginChallenge.updateMany({
            where: {
                id: initialChallenge.id,
                expiresAt: { gt: new Date() },
                attempts: { lt: MAX_CODE_ATTEMPTS }
            },
            data: { attempts: { increment: 1 } }
        });
        if (attempt.count !== 1) {
            await prisma.superAdminLoginChallenge.deleteMany({
                where: { id: initialChallenge.id, attempts: { gte: MAX_CODE_ATTEMPTS } }
            });
            return res.status(401).json({ success: false, message: "Invalid or expired sign-in code." });
        }

        const challenge = await prisma.superAdminLoginChallenge.findUnique({
            where: { id: initialChallenge.id }
        });
        if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
            return res.status(401).json({ success: false, message: "Invalid or expired sign-in code." });
        }

        const matches = await bcrypt.compare(parsed.data.code, challenge.codeHash);
        if (!matches) {
            if (challenge.attempts >= MAX_CODE_ATTEMPTS) {
                await prisma.superAdminLoginChallenge.deleteMany({ where: { id: challenge.id } });
            }
            return res.status(401).json({ success: false, message: "Invalid or expired sign-in code." });
        }

        const consumed = await prisma.superAdminLoginChallenge.deleteMany({
            where: {
                id: challenge.id,
                codeHash: challenge.codeHash,
                attempts: challenge.attempts
            }
        });
        if (consumed.count !== 1) {
            return res.status(401).json({ success: false, message: "Invalid or expired sign-in code." });
        }

        const publicUser = toPublicUser(user);
        const token = createToken(publicUser);
        return res.status(200).json({
            success: true,
            message: "Super Admin sign-in successful.",
            token,
            expiresIn: JWT_EXPIRES_IN,
            user: publicUser
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/me", authenticateToken, async (req, res, next) => {
    try {
        return res.status(200).json({
            success: true,
            user: req.user
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
