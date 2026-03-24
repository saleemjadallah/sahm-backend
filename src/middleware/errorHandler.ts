import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/index.js";
import { ZodError } from "zod";
import type { ApiResponse } from "../types/index.js";

/**
 * Global Fastify error handler. Normalizes all errors into a consistent API response format.
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error);

  // ── Zod Validation Error ─────────────────────────────
  if (error instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
    };
    reply.status(400).send(response);
    return;
  }

  // ── App Error (our custom errors) ────────────────────
  if (error instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // ── Fastify built-in errors (rate-limit, validation) ─
  if ("statusCode" in error && typeof error.statusCode === "number") {
    const response: ApiResponse = {
      success: false,
      error: {
        code: (error as FastifyError).code || "REQUEST_ERROR",
        message: error.message,
      },
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // ── Unexpected errors ────────────────────────────────
  const response: ApiResponse = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message,
    },
  };
  reply.status(500).send(response);
}
