"use strict";

const express = require("express");
const { z } = require("zod");
const { prisma } = require("../../database");

const router = express.Router();

router.get("/", async (_req, res, next) => {
    try {
        const packages = await prisma.package.findMany({
            where: { isActive: true },
            orderBy: [{ price: "asc" }, { durationDays: "asc" }],
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                durationDays: true,
                placement: true,
                features: true
            }
        });
        return res.json({ success: true, packages });
    } catch (error) {
        return next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) {
        return res.status(400).json({ success: false, message: "Invalid package ID." });
    }

    try {
        const item = await prisma.package.findFirst({
            where: { id: id.data, isActive: true },
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                durationDays: true,
                placement: true,
                features: true
            }
        });
        if (!item) {
            return res.status(404).json({ success: false, message: "Package not found." });
        }
        return res.json({ success: true, package: item });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
