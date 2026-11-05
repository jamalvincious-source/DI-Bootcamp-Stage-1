"use strict";

const express = require("express");
const { z } = require("zod");
const { prisma } = require("../../database");
const { authenticateToken } = require("../../../middleware/authenticate");

const router = express.Router();

const businessSchema = z.object({
    name: z.string().trim().min(2).max(160),
    category: z.string().trim().min(2).max(100),
    county: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30).optional(),
    description: z.string().trim().min(10).max(3000),
    image_url: z.string().trim().url().max(2048)
        .refine(value => /^https?:\/\//i.test(value), "Image URL must use HTTP or HTTPS.")
        .nullable()
        .optional()
});

const updateBusinessSchema = businessSchema.partial()
    .refine(data => Object.keys(data).length > 0, "Provide at least one field to update.");

const publicBusinessSelect = {
    id: true,
    name: true,
    category: true,
    county: true,
    phone: true,
    description: true,
    imageUrl: true,
    createdAt: true
};

function parseBusinessId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.get("/", async (req, res, next) => {
    const parsed = z.object({
        search: z.string().trim().max(100).optional().default(""),
        category: z.string().trim().max(100).optional().default(""),
        county: z.string().trim().max(100).optional().default(""),
        page: z.coerce.number().int().min(1).max(10000).optional().default(1),
        limit: z.coerce.number().int().min(1).max(50).optional().default(12)
    }).safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid business directory filters." });
    }

    const filters = parsed.data;
    const where = {
        status: "published",
        ...(filters.search ? {
            OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { description: { contains: filters.search, mode: "insensitive" } },
                { category: { contains: filters.search, mode: "insensitive" } },
                { county: { contains: filters.search, mode: "insensitive" } }
            ]
        } : {}),
        ...(filters.category ? {
            category: { contains: filters.category, mode: "insensitive" }
        } : {}),
        ...(filters.county ? {
            county: { contains: filters.county, mode: "insensitive" }
        } : {})
    };

    try {
        const [businesses, total] = await Promise.all([
            prisma.business.findMany({
                where,
                select: publicBusinessSelect,
                orderBy: { createdAt: "desc" },
                take: filters.limit,
                skip: (filters.page - 1) * filters.limit
            }),
            prisma.business.count({ where })
        ]);

        return res.json({
            success: true,
            businesses,
            page: filters.page,
            limit: filters.limit,
            total
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/mine", authenticateToken, async (req, res, next) => {
    try {
        const businesses = await prisma.business.findMany({
            where: req.user.role === "admin" ? undefined : { ownerId: req.user.id },
            orderBy: { createdAt: "desc" }
        });
        return res.json({ success: true, businesses });
    } catch (error) {
        return next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    const id = parseBusinessId(req.params.id);
    if (!id) {
        return res.status(400).json({ success: false, message: "Provide a valid business ID." });
    }

    try {
        const business = await prisma.business.findFirst({
            where: { id, status: "published" },
            select: publicBusinessSelect
        });
        if (!business) {
            return res.status(404).json({ success: false, message: "Business not found." });
        }
        return res.json({ success: true, business });
    } catch (error) {
        return next(error);
    }
});

router.post("/", authenticateToken, async (req, res, next) => {
    const parsed = businessSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Please check the business details you submitted.",
            errors: parsed.error.issues.map(issue => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        });
    }

    try {
        const business = await prisma.business.create({
            data: {
                name: parsed.data.name,
                category: parsed.data.category,
                county: parsed.data.county,
                phone: parsed.data.phone || null,
                description: parsed.data.description,
                imageUrl: parsed.data.image_url || null,
                ownerId: req.user.id,
                status: "pending"
            }
        });
        return res.status(201).json({
            success: true,
            message: "Business submitted for review.",
            business
        });
    } catch (error) {
        return next(error);
    }
});

router.patch("/:id", authenticateToken, async (req, res, next) => {
    const id = parseBusinessId(req.params.id);
    const parsed = updateBusinessSchema.safeParse(req.body);
    if (!id || !parsed.success) {
        return res.status(400).json({ success: false, message: "Provide a valid business ID and business details." });
    }

    const data = {
        ...parsed.data,
        ...(parsed.data.image_url !== undefined ? { imageUrl: parsed.data.image_url } : {}),
        status: "pending"
    };
    delete data.image_url;

    try {
        const result = await prisma.business.updateMany({
            where: {
                id,
                ...(req.user.role === "admin" ? {} : { ownerId: req.user.id })
            },
            data
        });
        if (!result.count) {
            return res.status(404).json({ success: false, message: "Business not found or you cannot edit it." });
        }

        const business = await prisma.business.findUnique({ where: { id } });
        return res.json({ success: true, message: "Business updated and sent for review.", business });
    } catch (error) {
        return next(error);
    }
});

router.delete("/:id", authenticateToken, async (req, res, next) => {
    const id = parseBusinessId(req.params.id);
    if (!id) {
        return res.status(400).json({ success: false, message: "Provide a valid business ID." });
    }

    try {
        const result = await prisma.business.deleteMany({
            where: {
                id,
                ...(req.user.role === "admin" ? {} : { ownerId: req.user.id })
            }
        });
        if (!result.count) {
            return res.status(404).json({ success: false, message: "Business not found or you cannot delete it." });
        }
        return res.json({ success: true, message: "Business deleted successfully." });
    } catch (error) {
        return next(error);
    }
});

module.exports = { router, businessSchema };
