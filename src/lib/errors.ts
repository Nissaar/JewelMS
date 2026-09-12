/**
 * Errors carrying an HTTP status, so route handlers can distinguish a caller
 * mistake (400) from a genuine server fault (500) instead of reporting both
 * as 500.
 */
export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'AppError';
  }
}

/** The request was invalid or refers to state that no longer permits the action. */
export const badRequest = (message: string) => new AppError(message, 400);

/** The referenced record does not exist. */
export const notFound = (message: string) => new AppError(message, 404);

/** Status to respond with for a thrown error, defaulting to 500. */
export const statusFor = (error: any): number =>
  error instanceof AppError ? error.statusCode : 500;
