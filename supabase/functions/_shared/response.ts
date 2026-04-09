import { getCorsHeaders } from './cors.ts';

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function headers(req: Request): Record<string, string> {
  return {
    ...SECURITY_HEADERS,
    ...getCorsHeaders(req),
    'X-Request-Id': crypto.randomUUID(),
  };
}

export function ok<T>(req: Request, data: T, status = 200): Response {
  return new Response(
    JSON.stringify({ data, error: null, timestamp: new Date().toISOString() }),
    { status, headers: headers(req) }
  );
}

export function err(req: Request, message: string, code: string, status = 400, details?: string): Response {
  return new Response(
    JSON.stringify({ data: null, error: { message, code, details }, timestamp: new Date().toISOString() }),
    { status, headers: headers(req) }
  );
}

export function validationErr(req: Request, fields: Array<{ field: string; message: string }>): Response {
  return new Response(
    JSON.stringify({ data: null, error: { message: 'Validación fallida', code: 'VALIDATION_ERROR', fields }, timestamp: new Date().toISOString() }),
    { status: 422, headers: headers(req) }
  );
}
