import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Global error-handling middleware.
 *
 * - ZodError  → 400 with structured validation details.
 * - All other → 500 Internal Server Error.
 *
 * Must be registered AFTER all routes in Express (4-arg signature).
 */
export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    // ── Zod validation errors ────────────────────────────────────────────
    if (err instanceof ZodError) {
        res.status(400).json({
            error: "Validation failed",
            details: err.issues.map((issue) => ({
                path: issue.path.join(".") || "(root)",
                message: issue.message,
            })),
        });
        return;
    }

    // ── Generic server errors ────────────────────────────────────────────
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
}
