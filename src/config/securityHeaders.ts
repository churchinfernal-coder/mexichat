/**
 * Security headers configuration.
 * Apply via meta tags in index.html or server config.
 */
export const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' blob: data: https://*.supabase.co https://*.mercadolibre.com https://*.mercadopago.com https://lh3.googleusercontent.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://*.mercadopago.com",
    "frame-src https://*.mercadopago.com",
    "media-src 'self' blob: https://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)',
};