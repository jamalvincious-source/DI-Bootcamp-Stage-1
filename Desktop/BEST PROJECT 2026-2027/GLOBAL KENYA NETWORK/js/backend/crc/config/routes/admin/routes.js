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

router.get("/listings", async (req, res, next) => {
    const parsed = z.enum(["pending", "published", "rejected", "all"])
        .default("pending")
        .safeParse(req.query.status || "pending");
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Choose pending, published, rejected, or all listings."
        });
    }

    try {
        const listings = await prisma.marketplaceListing.findMany({
            where: parsed.data === "all" ? undefined : { status: parsed.data },
            include: {
                seller: { select: { id: true, name: true, email: true, phone: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 200
        });
        return res.json({ success: true, listings });
    } catch (error) {
        return next(error);
    }
});

router.get("/businesses", async (req, res, next) => {
    const parsed = z.enum(["pending", "published", "rejected", "all"])
        .default("pending")
        .safeParse(req.query.status || "pending");
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Choose pending, published, rejected, or all businesses."
        });
    }

    try {
        const businesses = await prisma.business.findMany({
            where: parsed.data === "all" ? undefined : { status: parsed.data },
            include: {
                owner: { select: { id: true, name: true, email: true, phone: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 200
        });
        return res.json({ success: true, businesses });
    } catch (error) {
        return next(error);
    }
});

router.patch("/businesses/:id/review", async (req, res, next) => {
    const id = parseUserId(req.params.id);
    const parsed = z.object({
        status: z.enum(["published", "rejected"])
    }).safeParse(req.body);
    if (!id || !parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid business ID and a published or rejected status."
        });
    }

    try {
        const business = await prisma.business.findUnique({ where: { id } });
        if (!business) {
            return res.status(404).json({ success: false, message: "Business not found." });
        }

        const updated = await prisma.$transaction(async transaction => {
            const result = await transaction.business.update({
                where: { id },
                data: { status: parsed.data.status },
                include: {
                    owner: { select: { id: true, name: true, email: true } }
                }
            });
            await transaction.adminAuditLog.create({
                data: {
                    actorId: req.user.id,
                    action: `business.${parsed.data.status}`,
                    targetId: id,
                    details: `name=${business.name}; ownerId=${business.ownerId}`
                }
            });
            return result;
        });
        return res.json({
            success: true,
            message: `Business ${parsed.data.status}.`,
            business: updated
        });
    } catch (error) {
        return next(error);
    }
});

router.patch("/listings/:id/review", async (req, res, next) => {
    const id = parseUserId(req.params.id);
    const parsed = z.object({
        status: z.enum(["published", "rejected"])
    }).safeParse(req.body);
    if (!id || !parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid listing ID and a published or rejected status."
        });
    }

    try {
        const listing = await prisma.marketplaceListing.findUnique({ where: { id } });
        if (!listing) {
            return res.status(404).json({ success: false, message: "Listing not found." });
        }

        const updated = await prisma.$transaction(async transaction => {
            const result = await transaction.marketplaceListing.update({
                where: { id },
                data: { status: parsed.data.status }
            });
            await transaction.adminAuditLog.create({
                data: {
                    actorId: req.user.id,
                    action: `listing.${parsed.data.status}`,
                    targetId: id,
                    details: `title=${listing.title}; sellerId=${listing.sellerId}`
                }
            });
            return result;
        });
        return res.json({
            success: true,
            message: `Listing ${parsed.data.status}.`,
            listing: updated
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/adverts", async (req, res, next) => {
    const parsed = z.enum(["pending", "published", "rejected", "all"])
        .default("pending")
        .safeParse(req.query.status || "pending");
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Choose pending, published, rejected, or all adverts."
        });
    }

    try {
        const adverts = await prisma.advert.findMany({
            where: parsed.data === "all" ? undefined : { status: parsed.data },
            include: {
                business: { select: { id: true, name: true, county: true, owner: { select: { name: true, email: true } } } },
                package: { select: { name: true, durationDays: true, price: true, currency: true } },
                payments: { select: { id: true, status: true, amount: true, currency: true, createdAt: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 200
        });
        return res.json({ success: true, adverts });
    } catch (error) {
        return next(error);
    }
});

router.patch("/adverts/:id/review", async (req, res, next) => {
    const id = parseUserId(req.params.id);
    const parsed = z.object({ status: z.enum(["published", "rejected"]) }).safeParse(req.body);
    if (!id || !parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid advert ID and a published or rejected status."
        });
    }

    try {
        const advert = await prisma.advert.findUnique({
            where: { id },
            include: { package: true, business: { select: { name: true, ownerId: true } } }
        });
        if (!advert) {
            return res.status(404).json({ success: false, message: "Advert not found." });
        }
        if (parsed.data.status === "published" && advert.packageId) {
            const payment = await prisma.payment.findFirst({
                where: { advertId: id, status: "successful" },
                select: { id: true }
            });
            if (!payment) {
                return res.status(409).json({
                    success: false,
                    message: "This paid package advert cannot be published until its payment is verified."
                });
            }
        }

        const now = new Date();
        const updated = await prisma.$transaction(async transaction => {
            const result = await transaction.advert.update({
                where: { id },
                data: {
                    status: parsed.data.status,
                    ...(parsed.data.status === "published" ? {
                        startsAt: now,
                        endsAt: advert.package
                            ? new Date(now.getTime() + advert.package.durationDays * 86400000)
                            : null
                    } : {})
                },
                include: { business: { select: { name: true, ownerId: true } }, package: true }
            });
            await transaction.adminAuditLog.create({
                data: {
                    actorId: req.user.id,
                    action: `advert.${parsed.data.status}`,
                    targetId: id,
                    details: `title=${advert.title}; business=${advert.business.name}; ownerId=${advert.business.ownerId}`
                }
            });
            return result;
        });
        return res.json({
            success: true,
            message: `Advert ${parsed.data.status}.`,
            advert: updated
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/payments", async (_req, res, next) => {
    try {
        const payments = await prisma.payment.findMany({
            include: {
                user: { select: { id: true, name: true, email: true } },
                package: { select: { name: true } },
                advert: { select: { id: true, title: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 200
        });
        return res.json({ success: true, payments });
    } catch (error) {
        return next(error);
    }
});

const packageInputSchema = z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(1000).optional().default(""),
    price: z.coerce.number().finite().min(0).max(100000000),
    currency: z.string().trim().length(3).toUpperCase().optional().default("KES"),
    durationDays: z.coerce.number().int().min(1).max(3650),
    placement: z.enum(["standard", "featured", "banner"]),
    features: z.array(z.string().trim().min(1).max(200)).max(30).optional().default([]),
    isActive: z.boolean().optional().default(true)
});

function packageData(data) {
    const { features, ...fields } = data;
    return {
        ...fields,
        ...(features !== undefined ? { features: JSON.stringify(features) } : {})
    };
}

router.get("/packages", async (_req, res, next) => {
    try {
        const packages = await prisma.package.findMany({
            orderBy: [{ isActive: "desc" }, { price: "asc" }]
        });
        return res.json({ success: true, packages });
    } catch (error) {
        return next(error);
    }
});

router.post("/packages", async (req, res, next) => {
    const parsed = packageInputSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Provide valid advertising package details." });
    }
    try {
        const item = await prisma.$transaction(async transaction => {
            const created = await transaction.package.create({ data: packageData(parsed.data) });
            await transaction.adminAuditLog.create({
                data: { actorId: req.user.id, action: "package.created", targetId: created.id, details: created.name }
            });
            return created;
        });
        return res.status(201).json({ success: true, package: item });
    } catch (error) {
        if (error?.code === "P2002") {
            return res.status(409).json({ success: false, message: "A package with that name already exists." });
        }
        return next(error);
    }
});

router.patch("/packages/:id", async (req, res, next) => {
    const id = parseUserId(req.params.id);
    const parsed = packageInputSchema.partial()
        .refine(data => Object.keys(data).length > 0, "Provide at least one package field.")
        .safeParse(req.body);
    if (!id || !parsed.success) {
        return res.status(400).json({ success: false, message: "Provide a valid package ID and package fields." });
    }
    try {
        const fields = packageData(parsed.data);
        const item = await prisma.$transaction(async transaction => {
            const updated = await transaction.package.update({ where: { id }, data: fields });
            await transaction.adminAuditLog.create({
                data: { actorId: req.user.id, action: "package.updated", targetId: id, details: updated.name }
            });
            return updated;
        });
        return res.json({ success: true, package: item });
    } catch (error) {
        if (error?.code === "P2025") {
            return res.status(404).json({ success: false, message: "Package not found." });
        }
        if (error?.code === "P2002") {
            return res.status(409).json({ success: false, message: "A package with that name already exists." });
        }
        return next(error);
    }
});

router.delete("/packages/:id", async (req, res, next) => {
    const id = parseUserId(req.params.id);
    if (!id) {
        return res.status(400).json({ success: false, message: "Provide a valid package ID." });
    }
    try {
        const item = await prisma.$transaction(async transaction => {
            const updated = await transaction.package.update({
                where: { id },
                data: { isActive: false }
            });
            await transaction.adminAuditLog.create({
                data: { actorId: req.user.id, action: "package.deactivated", targetId: id, details: updated.name }
            });
            return updated;
        });
        return res.json({ success: true, package: item });
    } catch (error) {
        if (error?.code === "P2025") {
            return res.status(404).json({ success: false, message: "Package not found." });
        }
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
        const businessCount = await prisma.business.count({ where: { ownerId: id } });
        const orderCount = await prisma.order.count({ where: { userId: id } });
        if (businessCount > 0 || orderCount > 0) {
            return res.status(409).json({
                success: false,
                message: "This account has business listings or orders. Remove or transfer those records before deleting the account."
            });
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
