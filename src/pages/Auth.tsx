/**
 * MexiChat - Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 * Proprietary and confidential. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * See LICENSE file for details.
 */
/**
 * MEXICHAT – Auth Page
 * Clean white + royal blue design
 * Simple email/phone login & registration for messaging app
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import {
  Loader2, Lock, Mail, UserCircle,
  MessageCircle, Eye, EyeOff, Phone, ArrowLeft,
  CheckCircle2, KeyRound,
} from 'lucide-react';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

type AuthMethod = 'email' | 'phone';
type AuthView = 'signin' | 'signup' | 'forgot' | 'otp' | 'confirm-email';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECURITY: SANITIZE INPUT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function sanitizeName(input: string): string {
  return input.replace(/[^\p{L}\p{M}\s\-'.]/gu, '').slice(0, 100);
}

function sanitizePhone(input: string): string {
  return input.replace(/[^\d+\-() ]/g, '').slice(0, 20);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RATE LIMITER (Client-side only)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class RateLimiter {
  private attempts: number[] = [];
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 60_000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  canAttempt(): boolean {
    const now = Date.now();
    this.attempts = this.attempts.filter((t) => now - t < this.windowMs);
    return this.attempts.length < this.maxAttempts;
  }

  recordAttempt(): void { this.attempts.push(Date.now()); }

  getWaitTime(): number {
    if (this.attempts.length === 0) return 0;
    const oldest = this.attempts[0];
    return Math.max(0, Math.ceil((this.windowMs - (Date.now() - oldest)) / 1000));
  }

  reset(): void { this.attempts = []; }
}

const signInLimiter = new RateLimiter(5, 60_000);
const signUpLimiter = new RateLimiter(3, 120_000);
const otpLimiter = new RateLimiter(5, 300_000);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// VALIDATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const emailSchema = z.string().trim().email('Correo inválido').max(255);

const phoneSchema = z.string().trim()
  .min(10, 'Número muy corto')
  .max(20, 'Número muy largo')
  .regex(/^\+?[1-9]\d{7,14}$/, 'Formato inválido. Usa +52XXXXXXXXXX');

const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Contraseña muy larga')
  .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
  .regex(/[a-z]/, 'Debe tener al menos una minúscula')
  .regex(/[0-9]/, 'Debe tener al menos un número');

const otpSchema = z.string().length(6, 'El código debe ser de 6 dígitos').regex(/^\d{6}$/);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// i18n
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const i18n = {
  es: {
    signIn: 'Iniciar Sesión', signUp: 'Registrarse', email: 'Correo Electrónico',
    phone: 'Teléfono', password: 'Contraseña', fullName: 'Nombre Completo',
    forgotPassword: '¿Olvidaste tu contraseña?', resetPassword: 'Recuperar Contraseña',
    sendResetLink: 'Enviar enlace', resetSent: '¡Enlace enviado! Revisa tu correo.',
    backToSignIn: 'Volver', orUsePhone: 'o usa tu teléfono', orUseEmail: 'o usa tu correo',
    sendOtp: 'Enviar código SMS', verifyOtp: 'Verificar código', otpSent: 'Código enviado a',
    otpPlaceholder: '000000', resendOtp: 'Reenviar código', createAccount: 'Crear Cuenta',
    signingIn: 'Iniciando sesión...', signingUp: 'Registrando...',
    welcome: '¡Bienvenido!', signedIn: 'Sesión iniciada',
    signUpSuccess: '¡Registro exitoso!', checkEmail: 'Revisa tu correo para confirmar',
    checkPhone: 'Te enviamos un código SMS', validationError: 'Error de validación',
    signInError: 'Error al iniciar sesión', signUpError: 'Error al registrarse',
    error: 'Error', invalidCredentials: 'Credenciales inválidas.',
    tooManyAttempts: 'Demasiados intentos. Espera', seconds: 'segundos',
    secureMessaging: 'Mensajería segura y privada',
    passwordHint: 'Mín 8 caracteres, 1 mayúscula, 1 minúscula, 1 número',
    phoneHint: 'Formato: +52 55 1234 5678', emailPlaceholder: 'tu@email.com',
    phonePlaceholder: '+52 55 1234 5678', namePlaceholder: 'Tu nombre',
    confirmEmailTitle: 'Confirma tu correo',
    confirmEmailDesc: 'Te enviamos un enlace de confirmación a',
    confirmEmailAction: 'Revisa tu bandeja de entrada y spam',
    passwordStrength: { weak: 'Débil', fair: 'Regular', good: 'Buena', strong: 'Fuerte' },
    verifying: 'Verificando...',
  },
  en: {
    signIn: 'Sign In', signUp: 'Sign Up', email: 'Email',
    phone: 'Phone', password: 'Password', fullName: 'Full Name',
    forgotPassword: 'Forgot password?', resetPassword: 'Reset Password',
    sendResetLink: 'Send reset link', resetSent: 'Link sent! Check your email.',
    backToSignIn: 'Back', orUsePhone: 'or use phone', orUseEmail: 'or use email',
    sendOtp: 'Send SMS code', verifyOtp: 'Verify code', otpSent: 'Code sent to',
    otpPlaceholder: '000000', resendOtp: 'Resend code', createAccount: 'Create Account',
    signingIn: 'Signing in...', signingUp: 'Signing up...',
    welcome: 'Welcome!', signedIn: 'Signed in successfully',
    signUpSuccess: 'Sign up successful!', checkEmail: 'Check your email to confirm',
    checkPhone: 'We sent you an SMS code', validationError: 'Validation error',
    signInError: 'Sign in error', signUpError: 'Sign up error',
    error: 'Error', invalidCredentials: 'Invalid credentials.',
    tooManyAttempts: 'Too many attempts. Wait', seconds: 'seconds',
    secureMessaging: 'Secure and private messaging',
    passwordHint: 'Min 8 chars, 1 uppercase, 1 lowercase, 1 number',
    phoneHint: 'Format: +52 55 1234 5678', emailPlaceholder: 'your@email.com',
    phonePlaceholder: '+52 55 1234 5678', namePlaceholder: 'Your name',
    confirmEmailTitle: 'Confirm your email',
    confirmEmailDesc: 'We sent a confirmation link to',
    confirmEmailAction: 'Check your inbox and spam folder',
    passwordStrength: { weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong' },
    verifying: 'Verifying...',
  },
} as const;

type Strings = (typeof i18n)['es'] | (typeof i18n)['en'];

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DESIGN TOKENS – White + Royal Blue
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const C = {
  pageBg: '#f0f4f8',
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  inputBg: '#f8fafc',
  inputBorder: '#e2e8f0',
  inputFocus: '#3b82f6',
  blue: '#1d4ed8',
  blueDark: '#1e40af',
  blueLight: '#3b82f6',
  text: '#0f172a',
  textBody: '#475569',
  textMuted: '#94a3b8',
  danger: '#ef4444',
  success: '#22c55e',
  warn: '#f59e0b',
} as const;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PASSWORD STRENGTH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•ï¿½ï¿½ï¿½â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, color: C.danger, key: 'weak' as const };
  if (score === 2) return { score, color: C.warn, key: 'fair' as const };
  if (score === 3) return { score, color: C.blueLight, key: 'good' as const };
  return { score, color: C.success, key: 'strong' as const };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUB-COMPONENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function AuthInput({ id, icon, label, type = 'text', value, onChange, placeholder, required, hint, rightIcon, onRightClick, maxLength }: {
  id: string; icon: React.ReactNode; label: string; type?: string;
  value: string; onChange: (v: string) => void; placeholder?: string;
  required?: boolean; hint?: string; rightIcon?: React.ReactNode;
  onRightClick?: () => void; maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.textBody }}>{label}</Label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.blueLight }}>{icon}</div>
        <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
          placeholder={placeholder} className="pl-10 h-11 rounded-lg pr-10"
          style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.text }}
          maxLength={maxLength || 255}
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'off'}
        />
        {rightIcon && (
          <button type="button" onClick={onRightClick} className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            {rightIcon}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px]" style={{ color: C.textMuted }}>{hint}</p>}
    </div>
  );
}

function MethodToggle({ authMethod, onToggle, t }: { authMethod: AuthMethod; onToggle: () => void; t: Strings }) {
  return (
    <button type="button" onClick={onToggle} className="text-xs font-medium"
      style={{ color: C.blue, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      {authMethod === 'email' ? (
        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {t.orUsePhone}</span>
      ) : (
        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {t.orUseEmail}</span>
      )}
    </button>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const Auth = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { signIn: authSignIn, signUp: authSignUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const t: Strings = language === 'es' ? i18n.es : i18n.en;

  const [view, setView] = useState<AuthView>('signin');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInPhone, setSignInPhone] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpTarget, setOtpTarget] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => { return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }; }, []);

  const toggleAuthMethod = useCallback(() => setAuthMethod((p) => p === 'email' ? 'phone' : 'email'), []);

  const startOtpCooldown = useCallback(() => {
    setOtpCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setOtpCooldown((prev) => { if (prev <= 1) { clearInterval(cooldownRef.current); return 0; } return prev - 1; });
    }, 1000);
  }, []);

  const pwStrength = useMemo(() => getPasswordStrength(signUpPassword), [signUpPassword]);

  const handleSignUpNameChange = useCallback((v: string) => setSignUpName(sanitizeName(v)), []);
  const handleSignInPhoneChange = useCallback((v: string) => setSignInPhone(sanitizePhone(v)), []);
  const handleSignUpPhoneChange = useCallback((v: string) => setSignUpPhone(sanitizePhone(v)), []);
  const handleOtpChange = useCallback((v: string) => setOtpCode(v.replace(/\D/g, '').slice(0, 6)), []);

  // â”€â”€ SIGN IN â”€â”€
  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    if (!signInLimiter.canAttempt()) {
      toast({ title: t.error, description: `${t.tooManyAttempts} ${signInLimiter.getWaitTime()} ${t.seconds}`, variant: 'destructive' }); return;
    }
    setLoading(true); signInLimiter.recordAttempt();
    try {
      if (authMethod === 'email') {
        const v = z.object({ email: emailSchema, password: z.string().min(8) }).safeParse({ email: signInEmail, password: signInPassword });
        if (!v.success) { toast({ title: t.validationError, description: v.error.errors[0].message, variant: 'destructive' }); setLoading(false); return; }
        const { error } = await authSignIn(signInEmail.trim(), signInPassword);
        if (error) { toast({ title: t.signInError, description: t.invalidCredentials, variant: 'destructive' }); return; }
        signInLimiter.reset(); toast({ title: t.welcome, description: t.signedIn }); navigate('/');
      } else {
        const v = phoneSchema.safeParse(signInPhone);
        if (!v.success) { toast({ title: t.validationError, description: v.error.errors[0].message, variant: 'destructive' }); setLoading(false); return; }
        const { error } = await supabase.auth.signInWithOtp({ phone: signInPhone.trim() });
        if (error) { toast({ title: t.signInError, description: t.invalidCredentials, variant: 'destructive' }); return; }
        setOtpTarget(signInPhone.trim()); setView('otp'); startOtpCooldown();
        toast({ title: t.checkPhone, description: `${t.otpSent} ${signInPhone}` });
      }
    } catch { toast({ title: t.error, description: t.invalidCredentials, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [honeypot, authMethod, signInEmail, signInPassword, signInPhone, authSignIn, navigate, startOtpCooldown, t]);

  // â”€â”€ SIGN UP â”€â”€
  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    if (!signUpLimiter.canAttempt()) {
      toast({ title: t.error, description: `${t.tooManyAttempts} ${signUpLimiter.getWaitTime()} ${t.seconds}`, variant: 'destructive' }); return;
    }
    setLoading(true); signUpLimiter.recordAttempt();
    try {
      const name = sanitizeName(signUpName);
      if (authMethod === 'email') {
        const v = z.object({ email: emailSchema, password: passwordSchema, fullName: z.string().trim().min(2).max(100) }).safeParse({ email: signUpEmail, password: signUpPassword, fullName: name });
        if (!v.success) { toast({ title: t.validationError, description: v.error.errors[0].message, variant: 'destructive' }); setLoading(false); return; }
        const { error } = await authSignUp(signUpEmail.trim(), signUpPassword, name);
        if (error) { toast({ title: t.signUpError, description: error.message, variant: 'destructive' }); return; }
        signUpLimiter.reset(); setView('confirm-email');
      } else {
        const v = z.object({ phone: phoneSchema, password: passwordSchema, fullName: z.string().trim().min(2).max(100) }).safeParse({ phone: signUpPhone, password: signUpPassword, fullName: name });
        if (!v.success) { toast({ title: t.validationError, description: v.error.errors[0].message, variant: 'destructive' }); setLoading(false); return; }
        const { error } = await supabase.auth.signUp({
          phone: signUpPhone.trim(), password: signUpPassword,
          options: { data: { full_name: name, account_type: 'user' } },
        });
        if (error) { toast({ title: t.signUpError, description: error.message, variant: 'destructive' }); return; }
        signUpLimiter.reset(); setOtpTarget(signUpPhone.trim()); setView('otp'); startOtpCooldown();
        toast({ title: t.signUpSuccess, description: `${t.otpSent} ${signUpPhone}` });
      }
    } catch (err: unknown) {
      toast({ title: t.error, description: err instanceof Error ? err.message : 'Error', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [honeypot, authMethod, signUpName, signUpEmail, signUpPassword, signUpPhone, authSignUp, startOtpCooldown, t]);

  // â”€â”€ VERIFY OTP â”€â”€
  const handleVerifyOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpLimiter.canAttempt()) {
      toast({ title: t.error, description: `${t.tooManyAttempts} ${otpLimiter.getWaitTime()} ${t.seconds}`, variant: 'destructive' }); return;
    }
    const v = otpSchema.safeParse(otpCode);
    if (!v.success) { toast({ title: t.validationError, description: v.error.errors[0].message, variant: 'destructive' }); return; }
    setLoading(true); otpLimiter.recordAttempt();
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: otpTarget, token: otpCode, type: 'sms' });
      if (error) { toast({ title: t.error, description: error.message, variant: 'destructive' }); return; }
      otpLimiter.reset(); toast({ title: t.welcome, description: t.signedIn }); navigate('/');
    } catch (err: unknown) {
      toast({ title: t.error, description: err instanceof Error ? err.message : 'Error', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [otpCode, otpTarget, navigate, t]);

  const handleResendOtp = useCallback(async () => {
    if (otpCooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: otpTarget });
      if (error) throw error;
      startOtpCooldown(); toast({ title: 'âœ“', description: `${t.otpSent} ${otpTarget}` });
    } catch (err: unknown) {
      toast({ title: t.error, description: err instanceof Error ? err.message : 'Error', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [otpCooldown, otpTarget, startOtpCooldown, t]);

  // â”€â”€ FORGOT PASSWORD â”€â”€
  const handleForgotPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const v = emailSchema.safeParse(forgotEmail);
    if (!v.success) { toast({ title: t.validationError, description: v.error.errors[0].message, variant: 'destructive' }); return; }
    setLoading(true);
    try { await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo: `${window.location.origin}/auth?view=reset` }); }
    catch { /* silent */ }
    finally { toast({ title: 'âœ“', description: t.resetSent }); setView('signin'); setLoading(false); }
  }, [forgotEmail, t]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.pageBg }}>
      <div className="flex-1 flex items-center justify-center relative z-10 py-12 px-4">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})` }}>
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.text }}>
              Mexi<span style={{ color: C.blue }}>Chat</span>
            </h1>
            <p className="text-sm mt-2" style={{ color: C.textBody }}>{t.secureMessaging}</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-6 sm:p-8 shadow-lg" style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}>

            {/* Honeypot */}
            <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
              <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>

            {/* â•â•â• OTP VIEW â•â•â• */}
            {view === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="text-center mb-4">
                  <Phone className="h-10 w-10 mx-auto mb-3" style={{ color: C.blue }} />
                  <h2 className="text-lg font-bold" style={{ color: C.text }}>{t.verifyOtp}</h2>
                  <p className="text-sm mt-1" style={{ color: C.textBody }}>{t.otpSent} <strong style={{ color: C.blue }}>{otpTarget}</strong></p>
                </div>
                <AuthInput id="otp" icon={<KeyRound className="h-4 w-4" />} label="OTP" value={otpCode} onChange={handleOtpChange} placeholder={t.otpPlaceholder} required maxLength={6} />
                <Button type="submit" className="w-full h-11 font-bold text-sm rounded-lg text-white" style={{ background: C.blue }} disabled={loading || otpCode.length !== 6}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.verifying}</> : t.verifyOtp}
                </Button>
                <div className="flex justify-between items-center">
                  <button type="button" onClick={() => { setView('signin'); setOtpCode(''); }} className="text-xs flex items-center gap-1" style={{ color: C.textBody, background: 'none', border: 'none', cursor: 'pointer' }}>
                    <ArrowLeft className="h-3 w-3" /> {t.backToSignIn}
                  </button>
                  <button type="button" onClick={handleResendOtp} disabled={otpCooldown > 0 || loading} className="text-xs"
                    style={{ color: otpCooldown > 0 ? C.textMuted : C.blue, background: 'none', border: 'none', cursor: otpCooldown > 0 ? 'not-allowed' : 'pointer' }}>
                    {otpCooldown > 0 ? `${t.resendOtp} (${otpCooldown}s)` : t.resendOtp}
                  </button>
                </div>
              </form>
            )}

            {/* â•â•â• CONFIRM EMAIL VIEW â•â•â• */}
            {view === 'confirm-email' && (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: C.success }} />
                <h2 className="text-lg font-bold" style={{ color: C.text }}>{t.confirmEmailTitle}</h2>
                <p className="text-sm" style={{ color: C.textBody }}>{t.confirmEmailDesc} <strong style={{ color: C.blue }}>{signUpEmail}</strong></p>
                <p className="text-xs" style={{ color: C.textMuted }}>{t.confirmEmailAction}</p>
                <button type="button" onClick={() => setView('signin')} className="text-sm font-medium flex items-center gap-1 mx-auto"
                  style={{ color: C.blue, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <ArrowLeft className="h-3 w-3" /> {t.backToSignIn}
                </button>
              </div>
            )}

            {/* â•â•â• FORGOT PASSWORD VIEW â•â•â• */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="text-center mb-4">
                  <KeyRound className="h-10 w-10 mx-auto mb-3" style={{ color: C.blue }} />
                  <h2 className="text-lg font-bold" style={{ color: C.text }}>{t.resetPassword}</h2>
                </div>
                <AuthInput id="forgot-email" icon={<Mail className="h-4 w-4" />} label={t.email} type="email" value={forgotEmail} onChange={setForgotEmail} placeholder={t.emailPlaceholder} required />
                <Button type="submit" className="w-full h-11 font-bold text-sm rounded-lg text-white" style={{ background: C.blue }} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.sendResetLink}
                </Button>
                <button type="button" onClick={() => setView('signin')} className="text-xs flex items-center gap-1 mx-auto"
                  style={{ color: C.textBody, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <ArrowLeft className="h-3 w-3" /> {t.backToSignIn}
                </button>
              </form>
            )}

            {/* â•â•â• SIGN IN / SIGN UP TABS â•â•â• */}
            {(view === 'signin' || view === 'signup') && (
              <Tabs value={view} onValueChange={(v) => setView(v as AuthView)}>
                <TabsList className="grid w-full grid-cols-2 mb-6 p-1 rounded-lg" style={{ background: '#f1f5f9', border: `1px solid ${C.cardBorder}` }}>
                  <TabsTrigger value="signin" className="rounded-md text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    style={{ color: C.textBody }}>{t.signIn}</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-md text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    style={{ color: C.textBody }}>{t.signUp}</TabsTrigger>
                </TabsList>

                {/* Sign In */}
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-5">
                    {authMethod === 'email' ? (
                      <>
                        <AuthInput id="signin-email" icon={<Mail className="h-4 w-4" />} label={t.email} type="email" value={signInEmail} onChange={setSignInEmail} placeholder={t.emailPlaceholder} required />
                        <AuthInput id="signin-password" icon={<Lock className="h-4 w-4" />} label={t.password} type={showPassword ? 'text' : 'password'} value={signInPassword} onChange={setSignInPassword} placeholder="••••••••" required
                          rightIcon={showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} onRightClick={() => setShowPassword(!showPassword)} />
                      </>
                    ) : (
                      <AuthInput id="signin-phone" icon={<Phone className="h-4 w-4" />} label={t.phone} type="tel" value={signInPhone} onChange={handleSignInPhoneChange} placeholder={t.phonePlaceholder} required hint={t.phoneHint} />
                    )}
                    <div className="flex justify-between items-center">
                      <MethodToggle authMethod={authMethod} onToggle={toggleAuthMethod} t={t} />
                      {authMethod === 'email' && (
                        <button type="button" onClick={() => setView('forgot')} className="text-xs" style={{ color: C.blue, background: 'none', border: 'none', cursor: 'pointer' }}>{t.forgotPassword}</button>
                      )}
                    </div>
                    <Button type="submit" className="w-full h-11 font-bold text-sm rounded-lg text-white" style={{ background: C.blue }} disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.signingIn}</> : authMethod === 'phone' ? t.sendOtp : t.signIn}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign Up */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <AuthInput id="signup-name" icon={<UserCircle className="h-4 w-4" />} label={t.fullName} value={signUpName} onChange={handleSignUpNameChange} placeholder={t.namePlaceholder} required />
                    {authMethod === 'email' ? (
                      <AuthInput id="signup-email" icon={<Mail className="h-4 w-4" />} label={t.email} type="email" value={signUpEmail} onChange={setSignUpEmail} placeholder={t.emailPlaceholder} required />
                    ) : (
                      <AuthInput id="signup-phone" icon={<Phone className="h-4 w-4" />} label={t.phone} type="tel" value={signUpPhone} onChange={handleSignUpPhoneChange} placeholder={t.phonePlaceholder} required hint={t.phoneHint} />
                    )}
                    <div>
                      <AuthInput id="signup-password" icon={<Lock className="h-4 w-4" />} label={t.password} type={showSignUpPassword ? 'text' : 'password'} value={signUpPassword} onChange={setSignUpPassword} placeholder="••••••••" required hint={t.passwordHint}
                        rightIcon={showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} onRightClick={() => setShowSignUpPassword(!showSignUpPassword)} />
                      {signUpPassword.length > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pwStrength.score * 25}%`, background: pwStrength.color }} />
                          </div>
                          <span className="text-[10px] font-semibold" style={{ color: pwStrength.color }}>{t.passwordStrength[pwStrength.key]}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-start">
                      <MethodToggle authMethod={authMethod} onToggle={toggleAuthMethod} t={t} />
                    </div>
                    <Button type="submit" className="w-full h-11 font-bold text-sm rounded-lg text-white" style={{ background: C.blue }} disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.signingUp}</> : authMethod === 'phone' ? t.sendOtp : t.createAccount}
                      </Button>
                      <p className="text-xs text-center mt-3" style={{ color: C.textBody }}>
                        Al registrarte, aceptas nuestros{' '}
                        <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'underline' }}>Terminos de Servicio</a>
                        {' '}y{' '}
                        <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'underline' }}>Politica de Privacidad</a>.
                      </p>
                    </form>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;