import { Router, Request, Response } from "express";
import prisma from "../prismaClient";

const router = Router();

/**
 * POST /identify
 *
 * Identity Reconciliation endpoint.
 * Receives an email and/or phoneNumber and links them to an existing contact
 * cluster or creates a new one. Returns the consolidated contact "family".
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, phoneNumber } = req.body as {
            email?: string;
            phoneNumber?: string;
        };

        // At least one piece of contact info is required.
        if (!email && !phoneNumber) {
            res.status(400).json({ error: "At least one of email or phoneNumber is required." });
            return;
        }

        // ──────────────────────────────────────────────────────────────────────
        // STEP 1: Find all existing contacts that match either the email OR
        //         the phone number. We use an OR query so we catch contacts
        //         that share *any* piece of info with the incoming request.
        // ──────────────────────────────────────────────────────────────────────
        const conditions: any[] = [];
        if (email) conditions.push({ email });
        if (phoneNumber) conditions.push({ phoneNumber });

        const matchingContacts = await prisma.contact.findMany({
            where: {
                OR: conditions,
                deletedAt: null,
            },
            orderBy: { createdAt: "asc" },
        });

        // ──────────────────────────────────────────────────────────────────────
        // STEP 2: Resolve the "root" primary contact for every matching row.
        //         A secondary contact points to its primary via `linkedId`.
        //         We collect the unique primary IDs involved.
        // ──────────────────────────────────────────────────────────────────────
        const primaryIds = new Set<number>();

        for (const contact of matchingContacts) {
            if (contact.linkPrecedence === "primary") {
                primaryIds.add(contact.id);
            } else if (contact.linkedId !== null) {
                primaryIds.add(contact.linkedId);
            }
        }

        // ──────────────────────────────────────────────────────────────────────
        // SCENARIO 1 — Brand-new customer (no matches at all).
        // Create a new primary contact and return immediately.
        // ──────────────────────────────────────────────────────────────────────
        if (primaryIds.size === 0) {
            const newPrimary = await prisma.contact.create({
                data: {
                    email: email || null,
                    phoneNumber: phoneNumber || null,
                    linkPrecedence: "primary",
                },
            });

            res.status(200).json({
                contact: {
                    primaryContatctId: newPrimary.id,
                    emails: newPrimary.email ? [newPrimary.email] : [],
                    phoneNumbers: newPrimary.phoneNumber ? [newPrimary.phoneNumber] : [],
                    secondaryContactIds: [],
                },
            });
            return;
        }

        // ──────────────────────────────────────────────────────────────────────
        // SCENARIO 3 — Two different primary contacts matched.
        // The older primary stays primary; the newer one (and all its
        // secondaries) become secondary under the older primary.
        // ──────────────────────────────────────────────────────────────────────
        let rootPrimaryId: number;

        if (primaryIds.size > 1) {
            // Fetch the primary contact rows to compare createdAt.
            const primaries = await prisma.contact.findMany({
                where: { id: { in: Array.from(primaryIds) } },
                orderBy: { createdAt: "asc" },
            });

            // The oldest primary "wins".
            const oldestPrimary = primaries[0];
            rootPrimaryId = oldestPrimary.id;

            // All other primaries become secondary under the oldest primary.
            const otherPrimaryIds = primaries.slice(1).map((p) => p.id);

            // Demote the newer primary contacts → secondary.
            await prisma.contact.updateMany({
                where: { id: { in: otherPrimaryIds } },
                data: {
                    linkedId: rootPrimaryId,
                    linkPrecedence: "secondary",
                },
            });

            // Re-link all existing secondary contacts that pointed to the
            // demoted primaries so they now point to the surviving primary.
            await prisma.contact.updateMany({
                where: { linkedId: { in: otherPrimaryIds } },
                data: { linkedId: rootPrimaryId },
            });
        } else {
            // Only one primary matched — use it as the root.
            rootPrimaryId = Array.from(primaryIds)[0];
        }

        // ──────────────────────────────────────────────────────────────────────
        // STEP 3: Now that we have a single root primary, fetch the full
        //         cluster (primary + all its secondaries) to check whether
        //         the incoming info is truly new.
        // ──────────────────────────────────────────────────────────────────────
        const cluster = await prisma.contact.findMany({
            where: {
                OR: [{ id: rootPrimaryId }, { linkedId: rootPrimaryId }],
                deletedAt: null,
            },
            orderBy: { createdAt: "asc" },
        });

        // Collect all known emails and phones already in the cluster.
        const existingEmails = new Set(cluster.map((c) => c.email).filter(Boolean));
        const existingPhones = new Set(cluster.map((c) => c.phoneNumber).filter(Boolean));

        const isEmailNew = email && !existingEmails.has(email);
        const isPhoneNew = phoneNumber && !existingPhones.has(phoneNumber);

        // ──────────────────────────────────────────────────────────────────────
        // SCENARIO 2 — Incoming request has NEW info that extends the cluster.
        // Create a secondary contact to store the new piece(s) of info.
        // ──────────────────────────────────────────────────────────────────────
        if (isEmailNew || isPhoneNew) {
            const newSecondary = await prisma.contact.create({
                data: {
                    email: email || null,
                    phoneNumber: phoneNumber || null,
                    linkedId: rootPrimaryId,
                    linkPrecedence: "secondary",
                },
            });
            cluster.push(newSecondary);
        }

        // ──────────────────────────────────────────────────────────────────────
        // SCENARIO 4 — Nothing new; info already exists in the cluster.
        // We simply fall through and return the consolidated response below.
        // ──────────────────────────────────────────────────────────────────────

        // ──────────────────────────────────────────────────────────────────────
        // BUILD THE CONSOLIDATED RESPONSE
        // Primary contact's email and phone must come first in the arrays.
        // ──────────────────────────────────────────────────────────────────────
        const primary = cluster.find((c) => c.id === rootPrimaryId)!;

        const emails: string[] = [];
        const phoneNumbers: string[] = [];
        const secondaryContactIds: number[] = [];

        // Add primary's info first so it appears at index 0.
        if (primary.email) emails.push(primary.email);
        if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

        for (const contact of cluster) {
            if (contact.id === rootPrimaryId) continue; // already handled

            if (contact.email && !emails.includes(contact.email)) {
                emails.push(contact.email);
            }
            if (contact.phoneNumber && !phoneNumbers.includes(contact.phoneNumber)) {
                phoneNumbers.push(contact.phoneNumber);
            }
            secondaryContactIds.push(contact.id);
        }

        res.status(200).json({
            contact: {
                primaryContatctId: rootPrimaryId,
                emails,
                phoneNumbers,
                secondaryContactIds,
            },
        });
    } catch (error) {
        console.error("Error in /identify:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
