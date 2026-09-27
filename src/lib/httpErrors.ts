/**
 * One-line description of an outbound HTTP failure that is safe to log: status
 * and the provider's error body, or the network error code. Deliberately never
 * includes the request config, which holds API keys and tokens.
 */
export function describeHttpError(error: any): string {
  if (error?.response) {
    const data = error.response.data;
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    return `HTTP ${error.response.status}: ${(body || '').slice(0, 500)}`;
  }
  return error?.code ? `${error.code}: ${error.message}` : String(error?.message || error);
}
