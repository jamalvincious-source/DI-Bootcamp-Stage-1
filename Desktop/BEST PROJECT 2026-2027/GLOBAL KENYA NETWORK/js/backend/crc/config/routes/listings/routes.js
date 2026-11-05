"use strict";

const express = require("express");
const { z } = require("zod");
const { prisma } = require("../../database");
const { authenticateToken } = require("../../../middleware/authenticate");

const router = express.Router();
const conditions = ["New", "Like new", "Good", "Fair", "Refurbished"];
const categories = [
    "Agriculture & Farming",
    "Food & Restaurants",
    "Beauty & Personal Care",
    "Construction & Home Services",
    "Education & Training",
    "Healthcare & Medical Services",
    "Real Estate",
    "Retail & Shopping",
    "Technology & Electronics",
    "Transport & Logistics",
    "Tourism & Hospitality",
    "Other"
];

const listingSchema = z.object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10).max(3000),
    category: z.enum(categories),
    county: z.string().trim().min(2).max(100),
    price: z.coerce.number().finite().min(0).max(1000000000),
    condition: z.enum(conditions),
    imageUrl: z.string().trim().url().max(2048)
        .refine(value => /^https?:\/\//i.test(value), "Photo URL must use HTTP or HTTPS.")
        .nullable()
        .optional()
});

const updateListingSchema = listingSchema.partial()
    .refine(data => Object.keys(data).length > 0, "Provide at least one field to update.");

router.get("/", async (req, res, next) => {
    const parsed = z.object({
        q: z.string().trim().max(120).optional().default(""),
        category: z.string().trim().max(100).optional().default(""),
        county: z.string().trim().max(100).optional().default(""),
        condition: z.enum(conditions).optional(),
        minPrice: z.coerce.number().finite().min(0).optional(),
        maxPrice: z.coerce.number().finite().min(0).optional(),
        days: z.coerce.number().int().min(0).max(3650).optional().default(0),
        sort: z.enum(["newest", "price_asc", "price_desc"]).optional().default("newest")
    }).safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid listing filters." });
    }

    const filters = parsed.data;
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined &&
        filters.minPrice > filters.maxPrice) {
        return res.status(400).json({ success: false, message: "Minimum price cannot exceed maximum price." });
    }

    const where = {
        status: "published",
        ...(filters.q ? {
            OR: [
                { title: { contains: filters.q, mode: "insensitive" } },
                { description: { contains: filters.q, mode: "insensitive" } },
                { category: { contains: filters.q, mode: "insensitive" } },
                { county: { contains: filters.q, mode: "insensitive" } }
            ]
        } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.county ? { county: filters.county } : {}),
        ...(filters.condition ? { condition: filters.condition } : {}),
        ...(filters.minPrice !== undefined || filters.maxPrice !== undefined ? {
            price: {
                ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
                ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {})
            }
        } : {}),
        ...(filters.days > 0 ? {
            createdAt: { gte: new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000) }
        } : {})
    };

    try {
        const [listings, priceBounds] = await Promise.all([
            prisma.marketplaceListing.findMany({
                where,
                orderBy: filters.sort === "price_asc"
                    ? { price: "asc" }
                    : filters.sort === "price_desc"
                        ? { price: "desc" }
                        : { createdAt: "desc" },
                take: 100,
                include: {
                    seller: { select: { name: true, phone: true } }
                }
            }),
            prisma.marketplaceListing.aggregate({
                where: { status: "published" },
                _min: { price: true },
                _max: { price: true }
            })
        ]);

        return res.json({
            success: true,
            listings,
            total: listings.length,
            priceBounds: {
                min: priceBounds._min.price ?? 0,
                max: priceBounds._max.price ?? 100000
            }
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/mine", authenticateToken, async (req, res, next) => {
    try {
        const listings = await prisma.marketplaceListing.findMany({
            where: { sellerId: req.user.id },
            orderBy: { createdAt: "desc" }
        });
        return res.json({ success: true, listings });
    } catch (error) {
        return next(error);
    }
});

router.post("/", authenticateToken, async (req, res, next) => {
    const parsed = listingSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Please check your listing details.",
            errors: parsed.error.issues.map(issue => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        });
    }

    try {
        const listing = await prisma.marketplaceListing.create({
            data: {
                ...parsed.data,
                sellerId: req.user.id,
                status: "pending"
            }
        });
        return res.status(201).json({
            success: true,
            message: "Listing submitted for review.",
            listing
        });
    } catch (error) {
        return next(error);
    }
});

router.patch("/:id", authenticateToken, async (req, res, next) => {
    const id = Number(req.params.id);
    const parsed = updateListingSchema.safeParse(req.body);
    if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
        return res.status(400).json({ success: false, message: "Provide a valid listing ID and listing details." });
    }

    try {
        const result = await prisma.marketplaceListing.updateMany({
            where: { id, sellerId: req.user.id },
            data: { ...parsed.data, status: "pending" }
        });
        if (result.count === 0) {
            return res.status(404).json({ success: false, message: "Listing not found." });
        }

        const listing = await prisma.marketplaceListing.findUnique({ where: { id } });
        return res.json({ success: true, message: "Listing updated and sent for review.", listing });
    } catch (error) {
        return next(error);
    }
});

router.delete("/:id", authenticateToken, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ success: false, message: "Provide a valid listing ID." });
    }

    try {
        const result = await prisma.marketplaceListing.deleteMany({
            where: { id, sellerId: req.user.id }
        });
        if (result.count === 0) {
            return res.status(404).json({ success: false, message: "Listing not found." });
        }
        return res.json({ success: true, message: "Listing removed." });
    } catch (error) {
        return next(error);
    }
});

module.exports = { router, categories, conditions, listingSchema };
