import type { Response } from 'express';
import { ZodError } from 'zod';

/**
 * Errors carrying an HTTP status, so route handlers can distinguish a caller
 * mistake (400) from a genuine server fault (500) instead of reporting both
 * as 500.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    /** Machine-readable reason the frontend branches on, e.g. CLIENT_EMAIL_MISSING. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** The request was invalid or refers to state that no longer permits the action. */
export const badRequest = (message: string, code?: string) => new AppError(message, 400, code);

/** The referenced record does not exist. */
export const notFound = (message: string) => new AppError(message, 404);

/**
 * Whether a database error is a unique-constraint violation (duplicate key).
 * The driver's code is on the error itself or, when drizzle wraps it in a
 * DrizzleQueryError, on its cause.
 */
export const isUniqueViolation = (error: any): boolean =>
  error?.code === '23505' || error?.cause?.code === '23505';

/** Status to respond with for a thrown error, defaulting to 500. */
export const statusFor = (error: unknown): number => {
  if (error instanceof AppError) return error.statusCode;
  if (error instanceof ZodError) return 400;
  return 500;
};

/** Human-readable summary of a validation failure, e.g. "price: Expected number". */
export const describeZodError = (error: ZodError): string =>
  error.issues
    .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');

/**
 * Message safe to send to the client. Caller mistakes are explained; server
 * faults get the fallback so database or library internals never leak.
 */
export const messageFor = (error: unknown, fallback: string): string => {
  if (error instanceof AppError) return error.message;
  if (error instanceof ZodError) return describeZodError(error);
  return fallback;
};

/**
 * Sends the error response for a caught error and logs server faults.
 * Coded errors reply { error: CODE, message }; others reply { error: message }.
 */
export function sendError(res: Response, error: unknown, fallback: string, logLabel = fallback) {
  const status = statusFor(error);
  if (status >= 500) console.error(`${logLabel}:`, error);
  const message = messageFor(error, fallback);
  const code = error instanceof AppError ? error.code : undefined;
  res.status(status).json(code ? { success: false, error: code, message } : { error: message });
}
