"use strict";

const crypto = require("crypto");
const express = require("express");
const { z } = require("zod");
const { prisma } = require("../../../database");
const { authenticateToken } = require("../../../../middleware/authenticate");

const router = express.Router();
const paymentSchema = z.object({
    advertId: z.coerce.number().int().positive(),
    phone: z.string().trim().regex(/^(?:\+254|254|0)7\d{8}$/, "Enter a valid Kenyan mobile number.")
});

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.post("/", authenticateToken, async (req, res, next) => {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid payment details.",
            errors: parsed.error.issues.map(issue => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        });
    }

    try {
        const advert = await prisma.advert.findFirst({
            where: {
                id: parsed.data.advertId,
                business: { ownerId: req.user.id },
                packageId: { not: null }
            },
            include: { package: true }
        });
        if (!advert?.package || !advert.package.isActive) {
            return res.status(404).json({
                success: false,
                message: "A package-backed advert owned by your account was not found."
            });
        }

        const existingPayment = await prisma.payment.findFirst({
            where: {
                advertId: advert.id,
                userId: req.user.id,
                status: { in: ["pending", "processing", "successful"] }
            },
            orderBy: { createdAt: "desc" }
        });
        if (existingPayment) {
            return res.json({
                success: true,
                message: "A payment request already exists for this advert.",
                payment: existingPayment
            });
        }

        const payment = await prisma.payment.create({
            data: {
                userId: req.user.id,
                packageId: advert.packageId,
                advertId: advert.id,
                amount: advert.package.price,
                currency: advert.package.currency,
                phone: parsed.data.phone,
                status: "pending"
            },
            include: {
                package: { select: { name: true } },
                advert: { select: { id: true, title: true } }
            }
        });
        return res.status(201).json({
            success: true,
            message: "Payment request recorded. No payment has been collected; provider checkout must be configured separately.",
            payment
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/mine", authenticateToken, async (req, res, next) => {
    try {
        const payments = await prisma.payment.findMany({
            where: req.user.role === "super_admin" ? undefined : { userId: req.user.id },
            include: {
                package: { select: { name: true } },
                advert: { select: { id: true, title: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 100
        });
        return res.json({ success: true, payments });
    } catch (error) {
        return next(error);
    }
});

router.get("/:id", authenticateToken, async (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id) {
        return res.status(400).json({ success: false, message: "Invalid payment ID." });
    }

    try {
        const payment = await prisma.payment.findFirst({
            where: {
                id,
                ...(req.user.role === "super_admin" ? {} : { userId: req.user.id })
            },
            include: {
                package: { select: { name: true } },
                advert: { select: { id: true, title: true } }
            }
        });
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found." });
        }
        return res.json({ success: true, payment });
    } catch (error) {
        return next(error);
    }
});

router.post("/provider-confirmation", async (req, res, next) => {
    const expectedSecret = process.env.PAYMENT_CALLBACK_SECRET;
    const suppliedSecret = req.get("x-payment-callback-secret");
    if (!expectedSecret) {
        return res.status(503).json({
            success: false,
            message: "Payment confirmation is not configured."
        });
    }

    if (
        typeof suppliedSecret !== "string" ||
        Buffer.byteLength(suppliedSecret) !== Buffer.byteLength(expectedSecret) ||
        !crypto.timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(expectedSecret))
    ) {
        return res.status(401).json({ success: false, message: "Unauthorized payment confirmation." });
    }

    const parsed = z.object({
        paymentId: z.coerce.number().int().positive(),
        status: z.enum(["successful", "failed"]),
        providerReceipt: z.string().trim().min(1).max(100).optional()
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid payment confirmation." });
    }

    try {
        const result = await prisma.payment.updateMany({
            where: {
                id: parsed.data.paymentId,
                status: { in: ["pending", "processing"] }
            },
            data: {
                status: parsed.data.status,
                ...(parsed.data.providerReceipt ? { providerReceipt: parsed.data.providerReceipt } : {})
            }
        });
        if (!result.count) {
            return res.status(409).json({
                success: false,
                message: "Payment not found or already finalized."
            });
        }

        const payment = await prisma.payment.findUnique({
            where: { id: parsed.data.paymentId },
            select: { id: true, status: true, providerReceipt: true }
        });
        return res.json({ success: true, message: "Verified payment status recorded.", payment });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
