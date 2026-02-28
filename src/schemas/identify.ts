import { z } from "zod";

/**
 * Zod schema for the POST /identify request body.
 *
 * Rules:
 *  - `email` is optional but must be a valid email when provided.
 *  - `phoneNumber` is optional. Numbers are coerced to strings automatically.
 *  - At least one of the two fields must be present (superRefine).
 */
export const identifySchema = z
    .object({
        email: z
            .string()
            .email("Invalid email format")
            .optional()
            .nullable()
            .transform((v) => v ?? undefined),
        phoneNumber: z
            .union([z.string(), z.number().transform(String)])
            .optional()
            .nullable()
            .transform((v) => v ?? undefined),
    })
    .superRefine((data, ctx) => {
        if (!data.email && !data.phoneNumber) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "At least one of email or phoneNumber is required.",
                path: [],
            });
        }
    });

/** Inferred TypeScript type from the schema. */
export type IdentifyInput = z.infer<typeof identifySchema>;
