# Security Policy â€” MexiChat

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

**Email:** security@mexichat.app  
**PGP Key:** Available upon request  
**Response Time:** Within 48 hours  

### Do NOT:
- Open a public GitHub issue for security vulnerabilities
- Exploit the vulnerability beyond what is necessary to verify it
- Access, modify, or delete other users' data
- Perform denial-of-service attacks

### Do:
- Provide detailed reproduction steps
- Allow reasonable time for a fix before disclosure
- Report to security@mexichat.app only

## Security Measures

### Encryption
- **Messages:** AES-256-GCM with ECDH P-256 key exchange (E2E)
- **Storage:** AES-256 at rest (Supabase)
- **Transport:** TLS 1.3 (HTTPS only)
- **Key Management:** Per-conversation ephemeral keys

### Authentication
- **Passwords:** bcrypt with salt rounds >= 12
- **Biometric:** WebAuthn / platform authenticator API
- **2FA:** TOTP (RFC 6238) with encrypted secrets
- **Sessions:** Secure, HttpOnly, SameSite cookies
- **Rate Limiting:** Max 5 failed attempts, exponential backoff

### Content Security
- **CSP Headers:** Strict policy (no eval, no inline)
- **XSS Prevention:** Input sanitization, output encoding
- **CSRF Protection:** SameSite cookies + token validation
- **SQL Injection:** Parameterized queries (Supabase RLS)
- **File Upload:** Type validation, size limits, virus scanning

### Payment Security
- **Mercado Pago:** PCI-DSS compliant SDK integration
- **OXXO:** Server-side reference generation only
- **Biometric Verification:** Required for payments > $1,000 MXN

### Privacy
- **Data Minimization:** Collect only what's necessary
- **Right to Deletion:** Users can delete all data
- **No Tracking:** No analytics, no ad networks
- **No Data Sales:** User data is never sold or shared

## Compliance

- Mexican LFPDPPP (Federal Law on Protection of Personal Data)
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- COPPA (Children's Online Privacy Protection Act)
- PCI-DSS (Payment Card Industry Data Security Standard)
- Mexican NOM-151-SCFI (Electronic Messaging Standards)