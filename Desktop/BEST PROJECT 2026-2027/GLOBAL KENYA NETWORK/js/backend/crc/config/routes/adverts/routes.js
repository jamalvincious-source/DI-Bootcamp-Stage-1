"use strict";

const express = require("express");
const { z } = require("zod");
const { prisma } = require("../../database");
const { authenticateToken } = require("../../../middleware/authenticate");

const router = express.Router();
const placements = ["standard", "featured", "banner"];
const statuses = ["pending", "published", "rejected"];

const advertSchema = z.object({
    businessId: z.coerce.number().int().positive(),
    packageId: z.coerce.number().int().positive().optional(),
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().max(3000).optional(),
    imageUrl: z.string().trim().url().max(2048).nullable().optional(),
    targetUrl: z.string().trim().url().max(2048).nullable().optional(),
    placement: z.enum(placements).optional()
});

const updateAdvertSchema = advertSchema.omit({ businessId: true, packageId: true })
    .partial()
    .refine(data => Object.keys(data).length > 0, "Provide at least one field to update.");

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseStatus(value) {
    if (typeof value !== "string" || !statuses.includes(value)) return null;
    return value;
}

router.get("/", async (req, res, next) => {
    const placement = req.query.placement;
    const category = req.query.category;
    if (placement && !placements.includes(String(placement))) {
        return res.status(400).json({ success: false, message: "Invalid advert placement." });
    }
    if (category !== undefined &&
        (typeof category !== "string" || category.trim().length < 2 || category.trim().length > 100)) {
        return res.status(400).json({ success: false, message: "Invalid advert category." });
    }

    try {
        const now = new Date();
        const adverts = await prisma.advert.findMany({
            where: {
                status: "published",
                business: {
                    status: "published",
                    ...(category ? {
                        category: {
                            equals: category.trim(),
                            mode: "insensitive"
                        }
                    } : {})
                },
                AND: [
                    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                    { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
                ],
                ...(placement ? { placement: String(placement) } : {})
            },
            include: { business: { select: { name: true, county: true, category: true } } },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        const placementPriority = { banner: 0, featured: 1, standard: 2 };
        adverts.sort((first, second) =>
            placementPriority[first.placement] - placementPriority[second.placement] ||
            second.createdAt.getTime() - first.createdAt.getTime()
        );
        return res.json({ success: true, adverts });
    } catch (error) {
        return next(error);
    }
});

router.get("/mine", authenticateToken, async (req, res, next) => {
    try {
        const adverts = await prisma.advert.findMany({
            where: req.user.role === "super_admin"
                ? undefined
                : { business: { ownerId: req.user.id } },
            include: {
                business: { select: { id: true, name: true, county: true } },
                package: { select: { id: true, name: true, price: true, currency: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 100
        });
        return res.json({ success: true, adverts });
    } catch (error) {
        return next(error);
    }
});

router.post("/", authenticateToken, async (req, res, next) => {
    const parsed = advertSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid advert details.",
            errors: parsed.error.issues.map(issue => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        });
    }

    try {
        const data = parsed.data;
        const business = await prisma.business.findFirst({
            where: {
                id: data.businessId,
                status: "published",
                ...(req.user.role === "super_admin" ? {} : { ownerId: req.user.id })
            },
            select: { id: true }
        });
        if (!business) {
            return res.status(404).json({
                success: false,
                message: "Published business not found or you cannot advertise it."
            });
        }

        let packageRecord = null;
        if (data.packageId) {
            packageRecord = await prisma.package.findFirst({
                where: { id: data.packageId, isActive: true }
            });
            if (!packageRecord) {
                return res.status(404).json({ success: false, message: "Package not found or inactive." });
            }
        }

        const advert = await prisma.advert.create({
            data: {
                businessId: business.id,
                packageId: packageRecord?.id,
                title: data.title,
                description: data.description || null,
                imageUrl: data.imageUrl || null,
                targetUrl: data.targetUrl || null,
                placement: data.placement || packageRecord?.placement || "standard",
                status: "pending"
            },
            include: { business: { select: { name: true } }, package: true }
        });
        return res.status(201).json({
            success: true,
            message: "Advert submitted for review.",
            advert
        });
    } catch (error) {
        return next(error);
    }
});

router.patch("/:id", authenticateToken, async (req, res, next) => {
    const id = parseId(req.params.id);
    const parsed = updateAdvertSchema.safeParse(req.body);
    if (!id || !parsed.success) {
        return res.status(400).json({ success: false, message: "Provide a valid advert ID and advert details." });
    }

    try {
        const advert = await prisma.advert.findFirst({
            where: {
                id,
                ...(req.user.role === "super_admin" ? {} : { business: { ownerId: req.user.id } })
            },
            select: { id: true }
        });
        if (!advert) {
            return res.status(404).json({ success: false, message: "Advert not found or you cannot edit it." });
        }

        await prisma.advert.update({
            where: { id },
            data: { ...parsed.data, status: "pending" }
        });
        const updated = await prisma.advert.findUnique({
            where: { id },
            include: { business: { select: { name: true } }, package: true }
        });
        return res.json({ success: true, message: "Advert updated and sent for review.", advert: updated });
    } catch (error) {
        return next(error);
    }
});

module.exports = { router, parseId, parseStatus };
