/**
 * Central configuration. Fails fast on missing secrets rather than falling back
 * to a hardcoded default, which would make tokens forgeable by anyone who knows it.
 */

function requireSecret(name: string): string {
  const value = process.env[name];

  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `${name} is not set. Refusing to start: a missing secret would otherwise ` +
        `fall back to a well-known default and allow forged tokens.`
      );
    }
    // Outside production, generate a random per-process secret. Tokens won't
    // survive a restart, which is correct for local dev and better than a
    // shared constant.
    const generated = require('crypto').randomBytes(32).toString('hex');
    console.warn(`[config] ${name} is not set — using a random per-process value (dev only).`);
    return generated;
  }

  return value;
}

export const JWT_SECRET = requireSecret('JWT_SECRET');
