"use strict";

const express = require("express");
const bcrypt = require("bcrypt");
const { z } = require("zod");
const { prisma } = require("../../database");
const { authenticateToken, requireSuperAdmin } = require("../../../middleware/authenticate");

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const adminRoles = ["user", "advertiser", "admin"];

router.use(authenticateToken, requireSuperAdmin);

function parseUserId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.get("/overview", async (_req, res, next) => {
    try {
        const [totalUsers, activeUsers, inactiveUsers, usersByRole] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { isActive: true } }),
            prisma.user.count({ where: { isActive: false } }),
            prisma.user.groupBy({ by: ["role"], _count: { _all: true } })
        ]);

        return res.json({
            success: true,
            overview: {
                totalUsers,
                activeUsers,
                inactiveUsers,
                usersByRole: Object.fromEntries(usersByRole.map(item => [item.role, item._count._all]))
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/users", async (req, res, next) => {
    try {
        const query = z.string().trim().max(120).safeParse(req.query.q || "");
        if (!query.success) {
            return res.status(400).json({ success: false, message: "Search text is too long." });
        }

        const users = await prisma.user.findMany({
            where: query.data ? {
                OR: [
                    { name: { contains: query.data } },
                    { email: { contains: query.data } }
                ]
            } : undefined,
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        });

        return res.json({ success: true, users });
    } catch (error) {
        return next(error);
    }
});

router.post("/users", async (req, res, next) => {
    const parsed = z.object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(254),
        password: z.string().min(12).refine(
            password => Buffer.byteLength(password, "utf8") <= 72,
            "Password must not exceed 72 UTF-8 bytes."
        ),
        role: z.enum(["admin", "user", "advertiser"]).default("admin")
    }).safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid name, email, password (at least 12 characters), and role."
        });
    }

    try {
        const email = parsed.data.email.toLowerCase();
        const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
        const user = await prisma.$transaction(async transaction => {
            const created = await transaction.user.create({
                data: {
                    name: parsed.data.name,
                    email,
                    passwordHash,
                    role: parsed.data.role
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    createdAt: true
                }
            });
            await transaction.adminAuditLog.create({
                data: {
                    actorId: req.user.id,
                    action: "user.created",
                    targetId: created.id,
                    details: `role=${created.role}`
                }
            });
            return created;
        });
        return res.status(201).json({ success: true, user });
    } catch (error) {
        if (error?.code === "P2002") {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }
        return next(error);
    }
});

router.patch("/users/:id", async (req, res, next) => {
    const id = parseUserId(req.params.id);
    const parsed = z.object({
        role: z.enum(adminRoles).optional(),
        isActive: z.boolean().optional()
    }).refine(data => Object.keys(data).length > 0).safeParse(req.body);

    if (!id || !parsed.success) {
        return res.status(400).json({ success: false, message: "Provide a valid user ID and role or active status." });
    }

    try {
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        if (target.role === "super_admin") {
            return res.status(403).json({ success: false, message: "The configured super-admin account cannot be changed here." });
        }
        if (id === req.user.id && (parsed.data.role !== undefined || parsed.data.isActive === false)) {
            return res.status(400).json({ success: false, message: "You cannot change your own role or suspend your own account." });
        }

        const changes = Object.entries(parsed.data).map(([key, value]) => `${key}=${value}`).join(", ");
        const updated = await prisma.$transaction(async transaction => {
            const result = await transaction.user.update({
                where: { id },
                data: parsed.data,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true
                }
            });
            await transaction.adminAuditLog.create({
                data: {
                    actorId: req.user.id,
                    action: "user.updated",
                    targetId: id,
                    details: changes
                }
            });
            return result;
        });
        return res.json({ success: true, user: updated });
    } catch (error) {
        return next(error);
    }
});

router.delete("/users/:id", async (req, res, next) => {
    const id = parseUserId(req.params.id);
    if (!id) {
        return res.status(400).json({ success: false, message: "Provide a valid user ID." });
    }
    if (id === req.user.id) {
        return res.status(400).json({ success: false, message: "You cannot delete your own account." });
    }

    try {
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        if (target.role === "super_admin") {
            return res.status(403).json({ success: false, message: "The configured super-admin account cannot be deleted here." });
        }

        await prisma.$transaction([
            prisma.adminAuditLog.create({
                data: {
                    actorId: req.user.id,
                    action: "user.deleted",
                    targetId: id,
                    details: `email=${target.email}`
                }
            }),
            prisma.user.delete({ where: { id } })
        ]);
        return res.json({ success: true, message: "User deleted." });
    } catch (error) {
        return next(error);
    }
});

router.get("/audit-logs", async (req, res, next) => {
    try {
        const logs = await prisma.adminAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 200
        });
        return res.json({ success: true, logs });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
