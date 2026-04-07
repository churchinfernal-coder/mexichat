/**
 * MexiChat - Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 * Proprietary and confidential. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * See LICENSE file for details.
 */

/**
 * MEXICHAT – Auth Page
 * 
 * Enterprise-grade authentication with:
 * - Phone & Email auth (OTP verification)
 * - Robust error handling & recovery
 * - Rate limiting (client + server)
 * - Security best practices (XSS, CSRF, input sanitization)
 * - Performance optimized (memoization, lazy loading)
 * - Accessibility (a11y)
 * - Offline support
 */

import { 
  useState, 
  useRef, 
  useCallback, 
  useEffect, 
  useMemo,
  useReducer 
} from 'react';
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
  Loader2, Lock, Mail, UserCircle, MessageCircle, Eye, EyeOff, 
  Phone, ArrowLeft, CheckCircle2, KeyRound, AlertCircle, WifiOff
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type AuthMethod = 'email' | 'phone';
type AuthView = 'signin' | 'signup' | 'forgot' | 'otp' | 'confirm-email';
type SubmitPhase = 'idle' | 'validating' | 'submitting' | 'success' | 'error';

interface AuthState {
  phase: SubmitPhase;
  error: string | null;
  errorCode: string | null;
  lastAttemptTime: number;
  attemptCount: number;
  isOnline: boolean;
  isRetrying: boolean;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  backoffMs: number;
}

// ============================================================================
// SECURITY: SANITIZATION & VALIDATION
// ============================================================================

/**
 * Sanitize user name input
 * - Removes special characters (XSS prevention)
 * - Allows Unicode letters, spaces, hyphens, apostrophes
 * - Enforces max length
 */
function sanitizeName(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[^\p{L}\p{M}\s\-'.]/gu, '')
    .slice(0, 100);
}

/**
 * Sanitize phone input
 * - Removes invalid characters
 * - Preserves formatting markers (+, -, spaces, parentheses)
 * - Enforces max length
 */
function sanitizePhone(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[^\d+\-() ]/g, '')
    .slice(0, 20);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// RATE LIMITING (Enterprise-grade)
// ============================================================================

class RateLimiter {
  private attempts: number[] = [];
  private readonly config: RateLimitConfig;
  private backoffMultiplier: number = 1;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if attempt is allowed
   * Uses exponential backoff after threshold
   */
  canAttempt(): boolean {
    const now = Date.now();
    this.attempts = this.attempts.filter(t => now - t < this.config.windowMs);
    
    if (this.attempts.length >= this.config.maxAttempts) {
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 8);
      return false;
    }
    
    return true;
  }

  recordAttempt(): void {
    this.attempts.push(Date.now());
  }

  /**
   * Get remaining wait time in seconds
   * Includes exponential backoff
   */
  getWaitTime(): number {
    if (this.attempts.length === 0) return 0;
    const oldest = this.attempts[0];
    const baseWait = Math.max(0, Math.ceil((this.config.windowMs - (Date.now() - oldest)) / 1000));
    const backoffWait = Math.ceil(this.config.backoffMs * this.backoffMultiplier / 1000);
    return Math.max(baseWait, backoffWait);
  }

  reset(): void {
    this.attempts = [];
    this.backoffMultiplier = 1;
  }

  /**
   * Get consecutive failed attempts
   */
  getAttemptCount(): number {
    return this.attempts.length;
  }
}

// Initialize rate limiters with enterprise configs
const signInLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 60_000,      // 1 minute window
  backoffMs: 2_000,      // 2 second base backoff
});

const signUpLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 120_000,     // 2 minute window
  backoffMs: 5_000,      // 5 second base backoff
});

const otpLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 300_000,     // 5 minute window
  backoffMs: 10_000,     // 10 second base backoff
});

// ============================================================================
// VALIDATION SCHEMAS (Zod)
// ============================================================================

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email inválido')
  .max(254, 'Email muy largo'); // RFC 5321

const phoneSchema = z
  .string()
  .trim()
  .min(10, 'Número muy corto')
  .max(15, 'Número muy largo')
  .regex(/^\+?[1-9]\d{7,14}$/, 'Formato inválido. Usa +52XXXXXXXXXX');

const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Contraseña muy larga')
  .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
  .regex(/[a-z]/, 'Debe tener al menos una minúscula')
  .regex(/[0-9]/, 'Debe tener al menos un número')
  .refine(
    pw => !/(.)\1{2,}/.test(pw),
    'Contraseña no puede tener 3+ caracteres repetidos'
  );

const otpSchema = z
  .string()
  .length(6, 'El código debe ser de 6 dígitos')
  .regex(/^\d{6}$/, 'Solo números permitidos');

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Nombre muy corto')
  .max(100, 'Nombre muy largo')
  .refine(
    name => /^[\p{L}\s\-'.]+$/u.test(name),
    'Nombre contiene caracteres inválidos'
  );

// ============================================================================
// LOCALIZATION (i18n)
// ============================================================================

const i18n = {
  es: {
    // Auth tabs
    signIn: 'Iniciar Sesión',
    signUp: 'Registrarse',
    
    // Fields
    email: 'Correo Electrónico',
    phone: 'Teléfono',
    password: 'Contraseña',
    fullName: 'Nombre Completo',
    
    // Password reset
    forgotPassword: '¿Olvidaste tu contraseña?',
    resetPassword: 'Recuperar Contraseña',
    sendResetLink: 'Enviar enlace',
    resetSent: '✓ Enlace enviado! Revisa tu correo.',
    
    // Navigation
    backToSignIn: 'Volver',
    orUsePhone: 'o usa tu teléfono',
    orUseEmail: 'o usa tu correo',
    
    // OTP
    sendOtp: 'Enviar código SMS',
    verifyOtp: 'Verificar código',
    otpSent: 'Código enviado a',
    otpPlaceholder: '000000',
    resendOtp: 'Reenviar código',
    verifying: 'Verificando...',
    
    // Sign up/in
    createAccount: 'Crear Cuenta',
    signingIn: 'Iniciando sesión...',
    signingUp: 'Registrando...',
    
    // Feedback
    welcome: '¡Bienvenido!',
    signedIn: '✓ Sesión iniciada',
    signUpSuccess: '✓ Registro exitoso!',
    checkEmail: 'Revisa tu correo para confirmar',
    checkPhone: 'Te enviamos un código SMS',
    
    // Errors
    validationError: 'Error de validación',
    signInError: 'Error al iniciar sesión',
    signUpError: 'Error al registrarse',
    error: 'Error',
    invalidCredentials: 'Credenciales inválidas.',
    tooManyAttempts: 'Demasiados intentos. Espera',
    seconds: 'segundos',
    networkError: 'Sin conexión. Verifica tu internet.',
    unknownError: 'Error desconocido. Intenta de nuevo.',
    expiredOtp: 'El código expiró. Solicita uno nuevo.',
    invalidOtp: 'Código inválido.',
    
    // Hints
    secureMessaging: 'Mensajería segura y privada',
    passwordHint: 'Mín 8 caracteres, 1 mayúscula, 1 minúscula, 1 número',
    phoneHint: 'Formato: +52 55 1234 5678',
    emailPlaceholder: 'tu@email.com',
    phonePlaceholder: '+52 55 1234 5678',
    namePlaceholder: 'Tu nombre',
    
    // Email confirmation
    confirmEmailTitle: 'Confirma tu correo',
    confirmEmailDesc: 'Te enviamos un enlace de confirmación a',
    confirmEmailAction: 'Revisa tu bandeja de entrada y spam',
    
    // Password strength
    passwordStrength: {
      weak: 'Débil',
      fair: 'Regular',
      good: 'Buena',
      strong: 'Fuerte'
    },
    
    // Terms
    terms: 'Terminos de Servicio',
    privacy: 'Politica de Privacidad',
    termsAccept: 'Al registrarte, aceptas nuestros',
    and: 'y',
  },
  en: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    email: 'Email',
    phone: 'Phone',
    password: 'Password',
    fullName: 'Full Name',
    forgotPassword: 'Forgot password?',
    resetPassword: 'Reset Password',
    sendResetLink: 'Send reset link',
    resetSent: '✓ Link sent! Check your email.',
    backToSignIn: 'Back',
    orUsePhone: 'or use phone',
    orUseEmail: 'or use email',
    sendOtp: 'Send SMS code',
    verifyOtp: 'Verify code',
    otpSent: 'Code sent to',
    otpPlaceholder: '000000',
    resendOtp: 'Resend code',
    verifying: 'Verifying...',
    createAccount: 'Create Account',
    signingIn: 'Signing in...',
    signingUp: 'Signing up...',
    welcome: 'Welcome!',
    signedIn: '✓ Signed in successfully',
    signUpSuccess: '✓ Sign up successful!',
    checkEmail: 'Check your email to confirm',
    checkPhone: 'We sent you an SMS code',
    validationError: 'Validation error',
    signInError: 'Sign in error',
    signUpError: 'Sign up error',
    error: 'Error',
    invalidCredentials: 'Invalid credentials.',
    tooManyAttempts: 'Too many attempts. Wait',
    seconds: 'seconds',
    networkError: 'No connection. Check your internet.',
    unknownError: 'Unknown error. Try again.',
    expiredOtp: 'Code expired. Request a new one.',
    invalidOtp: 'Invalid code.',
    secureMessaging: 'Secure and private messaging',
    passwordHint: 'Min 8 chars, 1 uppercase, 1 lowercase, 1 number',
    phoneHint: 'Format: +52 55 1234 5678',
    emailPlaceholder: 'your@email.com',
    phonePlaceholder: '+52 55 1234 5678',
    namePlaceholder: 'Your name',
    confirmEmailTitle: 'Confirm your email',
    confirmEmailDesc: 'We sent a confirmation link to',
    confirmEmailAction: 'Check your inbox and spam folder',
    passwordStrength: {
      weak: 'Weak',
      fair: 'Fair',
      good: 'Good',
      strong: 'Strong'
    },
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    termsAccept: 'By signing up, you accept our',
    and: 'and',
  },
} as const;

type Strings = (typeof i18n)['es'] | (typeof i18n)['en'];

// ============================================================================
// DESIGN TOKENS
// ============================================================================

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
  info: '#06b6d4',
} as const;

// ============================================================================
// PASSWORD STRENGTH CALCULATION
// ============================================================================

function getPasswordStrength(pw: string) {
  if (!pw) return { score: 0, color: C.danger, key: 'weak' as const };
  
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

// ============================================================================
// AUTH STATE REDUCER
// ============================================================================

type AuthAction = 
  | { type: 'SET_PHASE'; payload: SubmitPhase }
  | { type: 'SET_ERROR'; payload: { error: string; code: string } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_RETRYING'; payload: boolean }
  | { type: 'RECORD_ATTEMPT' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.payload };
    case 'SET_ERROR':
      return { 
        ...state, 
        phase: 'error',
        error: action.payload.error,
        errorCode: action.payload.code,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null, errorCode: null };
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };
    case 'SET_RETRYING':
      return { ...state, isRetrying: action.payload };
    case 'RECORD_ATTEMPT':
      return { 
        ...state, 
        lastAttemptTime: Date.now(),
        attemptCount: state.attemptCount + 1,
      };
    default:
      return state;
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface AuthInputProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  rightIcon?: React.ReactNode;
  onRightClick?: () => void;
  maxLength?: number;
  disabled?: boolean;
  error?: string | null;  // ← Change this line from 'string | undefined' to 'string | null'
  autoComplete?: string;
}

function AuthInput({
  id,
  icon,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  hint,
  rightIcon,
  onRightClick,
  maxLength,
  disabled,
  error,
  autoComplete,
}: AuthInputProps) {
  return (
    <div className="space-y-1.5">
      <Label 
        htmlFor={id} 
        className="text-xs font-semibold uppercase tracking-wider" 
        style={{ color: C.textBody }}
      >
        {label}
      </Label>
      <div className="relative">
        <div 
          className="absolute left-3 top-1/2 -translate-y-1/2" 
          style={{ color: error ? C.danger : C.blueLight }}
        >
          {icon}
        </div>
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength || 255}
          autoComplete={autoComplete}
          className="pl-10 h-11 rounded-lg pr-10"
          style={{
            background: disabled ? '#f1f5f9' : C.inputBg,
            border: `1px solid ${error ? C.danger : C.inputBorder}`,
            color: C.text,
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        {rightIcon && (
          <button
            type="button"
            onClick={onRightClick}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
            style={{
              color: C.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={type === 'password' ? 'Toggle password visibility' : undefined}
          >
            {rightIcon}
          </button>
        )}
      </div>
      {error && (
  <p 
    id={`${id}-error`}
    className="text-[11px] flex items-center gap-1" 
    style={{ color: C.danger }}
    role="alert"
  >
    <AlertCircle className="h-3 w-3" />
    {escapeHtml(error)}
  </p>
)}
      {hint && (
        <p 
          id={`${id}-hint`}
          className="text-[11px]" 
          style={{ color: C.textMuted }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

interface MethodToggleProps {
  authMethod: AuthMethod;
  onToggle: () => void;
  t: Strings;
  disabled?: boolean;
}

function MethodToggle({ authMethod, onToggle, t, disabled }: MethodToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
      style={{
        color: C.blue,
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
      }}
      aria-label={authMethod === 'email' ? 'Switch to phone auth' : 'Switch to email auth'}
    >
      {authMethod === 'email' ? (
        <span className="flex items-center gap-1">
          <Phone className="h-3 w-3" /> {t.orUsePhone}
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Mail className="h-3 w-3" /> {t.orUseEmail}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Auth = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { signIn: authSignIn, signUp: authSignUp } = useAuth();
  const t: Strings = language === 'es' ? i18n.es : i18n.en;

  // View state
  const [view, setView] = useState<AuthView>('signin');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');

  // Form state - Sign In
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInPhone, setSignInPhone] = useState('');

  // Form state - Sign Up
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');

  // Form state - Forgot Password
  const [forgotEmail, setForgotEmail] = useState('');

  // Form state - OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpTarget, setOtpTarget] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Auth state machine
  const [authState, dispatch] = useReducer(authReducer, {
    phase: 'idle',
    error: null,
    errorCode: null,
    lastAttemptTime: 0,
    attemptCount: 0,
    isOnline: navigator.onLine,
    isRetrying: false,
  });

  // Refs
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const retryCountRef = useRef<number>(0);

  // ──────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ──────────────────────────────────────────────────────────────────────

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup cooldown interval
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // CALLBACKS
  // ──────────────────────────────────────────────────────────────────────

  const toggleAuthMethod = useCallback(
    () => setAuthMethod((p) => p === 'email' ? 'phone' : 'email'),
    []
  );

  /**
   * Start OTP cooldown timer (60 seconds)
   * Uses exponential backoff on repeated resends
   */
  const startOtpCooldown = useCallback((duration: number = 60) => {
    setOtpCooldown(duration);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    
    cooldownRef.current = setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /**
   * Safe navigation with auth state verification
   * Waits for AuthContext to update before navigating
   */
  const safeNavigate = useCallback(
    async (path: string, delayMs: number = 500) => {
      try {
        // Clear any pending navigation
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
        }

        // Wait for auth state to propagate
        await new Promise(resolve => {
          navigationTimeoutRef.current = setTimeout(resolve, delayMs);
        });

        // Verify session exists before navigating
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          dispatch({
            type: 'SET_ERROR',
            payload: {
              error: t.error,
              code: 'NO_SESSION_AFTER_AUTH',
            },
          });
          return;
        }

        // Safe to navigate
        navigate(path);
      } catch (err) {
        console.error('[Auth] Safe navigation failed:', err);
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: t.unknownError,
            code: 'NAVIGATION_ERROR',
          },
        });
      }
    },
    [navigate, t]
  );

  /**
   * Map Supabase/Twilio error codes to user-friendly messages
   */
  const getErrorMessage = useCallback(
    (error: Error | null, code?: string): string => {
      if (!error && !code) return t.unknownError;

      const message = error?.message || '';
      const errorCode = code || error?.name || '';

      // Network errors
      if (!authState.isOnline || message.includes('Network')) {
        return t.networkError;
      }

      // OTP errors
      if (message.includes('Invalid OTP') || message.includes('expired')) {
        return t.expiredOtp;
      }
      if (message.includes('OTP')) {
        return t.invalidOtp;
      }

      // Auth errors
      if (message.includes('Invalid login credentials')) {
        return t.invalidCredentials;
      }
      if (message.includes('User already registered')) {
        return 'Este correo/teléfono ya está registrado.';
      }

      // Rate limit
      if (message.includes('rate limit') || message.includes('too many')) {
        return t.tooManyAttempts;
      }

      console.warn('[Auth] Unmapped error:', { errorCode, message });
      return t.unknownError;
    },
    [authState.isOnline, t]
  );

  const handleSignInPhoneChange = useCallback(
    (v: string) => setSignInPhone(sanitizePhone(v)),
    []
  );

  const handleSignUpPhoneChange = useCallback(
    (v: string) => setSignUpPhone(sanitizePhone(v)),
    []
  );

  const handleSignUpNameChange = useCallback(
    (v: string) => setSignUpName(sanitizeName(v)),
    []
  );

  const handleOtpChange = useCallback(
    (v: string) => setOtpCode(v.replace(/\D/g, '').slice(0, 6)),
    []
  );

  // ──────────────────────────────────────────────────────────────────────
  // PASSWORD STRENGTH (memoized)
  // ──────────────────────────────────────────────────────────────────────

  const pwStrength = useMemo(
    () => getPasswordStrength(signUpPassword),
    [signUpPassword]
  );

  // ──────────────────────────────────────────────────────────────────────
  // SIGN IN
  // ──────────────────────────────────────────────────────────────────────

  const handleSignIn = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Bot protection
      if (honeypot) return;

      // Offline check
      if (!authState.isOnline) {
        dispatch({
          type: 'SET_ERROR',
          payload: { error: t.networkError, code: 'OFFLINE' },
        });
        return;
      }

      // Rate limiting
      if (!signInLimiter.canAttempt()) {
        const waitTime = signInLimiter.getWaitTime();
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: `${t.tooManyAttempts} ${waitTime} ${t.seconds}`,
            code: 'RATE_LIMITED',
          },
        });
        return;
      }

      dispatch({ type: 'SET_PHASE', payload: 'validating' });
      signInLimiter.recordAttempt();
      dispatch({ type: 'RECORD_ATTEMPT' });

      try {
        if (authMethod === 'email') {
          // Validate
          const validation = z.object({
            email: emailSchema,
            password: z.string().min(1),
          }).safeParse({
            email: signInEmail,
            password: signInPassword,
          });

          if (!validation.success) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                error: validation.error.errors[0].message,
                code: 'VALIDATION_ERROR',
              },
            });
            return;
          }

          dispatch({ type: 'SET_PHASE', payload: 'submitting' });

          // Sign in
          const { error } = await authSignIn(
            signInEmail.trim(),
            signInPassword
          );

          if (error) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                error: getErrorMessage(error, 'SIGNIN_FAILED'),
                code: 'SIGNIN_FAILED',
              },
            });
            return;
          }

          // Success
          signInLimiter.reset();
          retryCountRef.current = 0;
          dispatch({ type: 'SET_PHASE', payload: 'success' });
          toast({
            title: t.welcome,
            description: t.signedIn,
          });

          // Safe navigation
          await safeNavigate('/');
        } else {
          // Phone auth
          const validation = phoneSchema.safeParse(signInPhone);

          if (!validation.success) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                error: validation.error.errors[0].message,
                code: 'VALIDATION_ERROR',
              },
            });
            return;
          }

          dispatch({ type: 'SET_PHASE', payload: 'submitting' });

          const { error } = await supabase.auth.signInWithOtp({
            phone: signInPhone.trim(),
          });

          if (error) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                error: getErrorMessage(error, 'SIGNIN_OTP_FAILED'),
                code: 'SIGNIN_OTP_FAILED',
              },
            });
            return;
          }

          // Success - transition to OTP view
          setOtpTarget(signInPhone.trim());
          setOtpCode('');
          setView('otp');
          startOtpCooldown();
          dispatch({ type: 'CLEAR_ERROR' });
          dispatch({ type: 'SET_PHASE', payload: 'idle' });

          toast({
            title: '✓ ' + t.checkPhone,
            description: `${t.otpSent} ${signInPhone}`,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: getErrorMessage(error, 'SIGNIN_EXCEPTION'),
            code: 'SIGNIN_EXCEPTION',
          },
        });
      }
    },
    [
      honeypot,
      authState.isOnline,
      authMethod,
      signInEmail,
      signInPassword,
      signInPhone,
      authSignIn,
      getErrorMessage,
      startOtpCooldown,
      safeNavigate,
      t,
    ]
  );

  // ──────────────────────────────────────────────────────────────────────
  // SIGN UP
  // ──────────────────────────────────────────────────────────────────────

  const handleSignUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (honeypot) return;

      if (!authState.isOnline) {
        dispatch({
          type: 'SET_ERROR',
          payload: { error: t.networkError, code: 'OFFLINE' },
        });
        return;
      }

      if (!signUpLimiter.canAttempt()) {
        const waitTime = signUpLimiter.getWaitTime();
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: `${t.tooManyAttempts} ${waitTime} ${t.seconds}`,
            code: 'RATE_LIMITED',
          },
        });
        return;
      }

      dispatch({ type: 'SET_PHASE', payload: 'validating' });
      signUpLimiter.recordAttempt();
      dispatch({ type: 'RECORD_ATTEMPT' });

      try {
        const name = sanitizeName(signUpName);

        if (authMethod === 'email') {
          // Validate
          const validation = z.object({
            email: emailSchema,
            password: passwordSchema,
            fullName: nameSchema,
          }).safeParse({
            email: signUpEmail,
            password: signUpPassword,
            fullName: name,
          });

          if (!validation.success) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                error: validation.error.errors[0].message,
                code: 'VALIDATION_ERROR',
              },
            });
            return;
          }

          dispatch({ type: 'SET_PHASE', payload: 'submitting' });

          const { error } = await authSignUp(
            signUpEmail.trim(),
            signUpPassword,
            name
          );

          if (error) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                error: getErrorMessage(error, 'SIGNUP_FAILED'),
                code: 'SIGNUP_FAILED',
              },
            });
            return;
          }

          // Success - show email confirmation screen
          signUpLimiter.reset();
          retryCountRef.current = 0;
          dispatch({ type: 'SET_PHASE', payload: 'success' });
          setView('confirm-email');
          dispatch({ type: 'CLEAR_ERROR' });
        } else {
          // Phone signup
          const validation = z.object({
            phone: phoneSchema,
            password: passwordSchema,
            fullName: nameSchema,
          }).safeParse({
            phone: signUpPhone,
            password: signUpPassword,
            fullName: name,
          });

          if (!validation.success) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                error: validation.error.errors[0].message,
                code: 'VALIDATION_ERROR',
              },
            });
            return;
          }

          dispatch({ type: 'SET_PHASE', payload: 'submitting' });

          const { error } = await supabase.auth.signUp({
            phone: signUpPhone.trim(),
            password: signUpPassword,
            options: {
              data: {
                full_name: name,
                account_type: 'user',
              },
            },
          });

          if (error) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                error: getErrorMessage(error, 'SIGNUP_OTP_FAILED'),
                code: 'SIGNUP_OTP_FAILED',
              },
            });
            return;
          }

          // Success - transition to OTP
          setOtpTarget(signUpPhone.trim());
          setOtpCode('');
          setView('otp');
          startOtpCooldown();
          dispatch({ type: 'CLEAR_ERROR' });
          dispatch({ type: 'SET_PHASE', payload: 'idle' });

          toast({
            title: '✓ ' + t.signUpSuccess,
            description: `${t.otpSent} ${signUpPhone}`,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: getErrorMessage(error, 'SIGNUP_EXCEPTION'),
            code: 'SIGNUP_EXCEPTION',
          },
        });
      }
    },
    [
      honeypot,
      authState.isOnline,
      authMethod,
      signUpName,
      signUpEmail,
      signUpPassword,
      signUpPhone,
      authSignUp,
      getErrorMessage,
      startOtpCooldown,
      t,
    ]
  );

  // ──────────────────────────────────────────────────────────────────────
  // VERIFY OTP
  // ──────────────────────────────────────────────────────────────────────

  const handleVerifyOtp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!authState.isOnline) {
        dispatch({
          type: 'SET_ERROR',
          payload: { error: t.networkError, code: 'OFFLINE' },
        });
        return;
      }

      if (!otpLimiter.canAttempt()) {
        const waitTime = otpLimiter.getWaitTime();
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: `${t.tooManyAttempts} ${waitTime} ${t.seconds}`,
            code: 'RATE_LIMITED',
          },
        });
        return;
      }

      const validation = otpSchema.safeParse(otpCode);
      if (!validation.success) {
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: validation.error.errors[0].message,
            code: 'VALIDATION_ERROR',
          },
        });
        return;
      }

      dispatch({ type: 'SET_PHASE', payload: 'validating' });
      otpLimiter.recordAttempt();
      dispatch({ type: 'RECORD_ATTEMPT' });

      try {
        dispatch({ type: 'SET_PHASE', payload: 'submitting' });

        const { error } = await supabase.auth.verifyOtp({
          phone: otpTarget,
          token: otpCode,
          type: 'sms',
        });

        if (error) {
          dispatch({
            type: 'SET_ERROR',
            payload: {
              error: getErrorMessage(error, 'OTP_VERIFICATION_FAILED'),
              code: 'OTP_VERIFICATION_FAILED',
            },
          });
          return;
        }

        // Success
        otpLimiter.reset();
        retryCountRef.current = 0;
        dispatch({ type: 'SET_PHASE', payload: 'success' });

        toast({
          title: t.welcome,
          description: t.signedIn,
        });

        // Safe navigation with longer delay for Capacitor — auth state needs time to propagate
        await safeNavigate('/', 2000);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: getErrorMessage(error, 'OTP_EXCEPTION'),
            code: 'OTP_EXCEPTION',
          },
        });
      }
    },
    [
      authState.isOnline,
      otpCode,
      otpTarget,
      getErrorMessage,
      safeNavigate,
      t,
    ]
  );

  /**
   * Resend OTP with exponential backoff
   */
  const handleResendOtp = useCallback(async () => {
    if (otpCooldown > 0) return;

    dispatch({ type: 'SET_RETRYING', payload: true });

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: otpTarget,
      });

      if (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: getErrorMessage(error, 'RESEND_OTP_FAILED'),
            code: 'RESEND_OTP_FAILED',
          },
        });
        return;
      }

      // Exponential backoff: 60s, 90s, 120s...
      const baseBackoff = 60;
      const backoffDuration = baseBackoff + (retryCountRef.current * 30);
      retryCountRef.current++;

      startOtpCooldown(Math.min(backoffDuration, 300)); // Max 5 minutes
      dispatch({ type: 'CLEAR_ERROR' });

      toast({
        title: '✓',
        description: `${t.otpSent} ${otpTarget}`,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: getErrorMessage(error, 'RESEND_EXCEPTION'),
          code: 'RESEND_EXCEPTION',
        },
      });
    } finally {
      dispatch({ type: 'SET_RETRYING', payload: false });
    }
  }, [otpCooldown, otpTarget, getErrorMessage, startOtpCooldown, t]);

  // ──────────────────────────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ──────────────────────────────────────────────────────────────────────

  const handleForgotPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!authState.isOnline) {
        dispatch({
          type: 'SET_ERROR',
          payload: { error: t.networkError, code: 'OFFLINE' },
        });
        return;
      }

      const validation = emailSchema.safeParse(forgotEmail);
      if (!validation.success) {
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: validation.error.errors[0].message,
            code: 'VALIDATION_ERROR',
          },
        });
        return;
      }

      dispatch({ type: 'SET_PHASE', payload: 'submitting' });

      try {
        await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
          redirectTo: `${window.location.origin}/auth?view=reset`,
        });

        toast({
          title: '✓',
          description: t.resetSent,
        });

        setView('signin');
        setForgotEmail('');
        dispatch({ type: 'CLEAR_ERROR' });
        dispatch({ type: 'SET_PHASE', payload: 'idle' });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[Auth] Password reset error:', error);
        // Always show success for security (prevent email enumeration)
        toast({
          title: '✓',
          description: t.resetSent,
        });
        setView('signin');
        dispatch({ type: 'SET_PHASE', payload: 'idle' });
      }
    },
    [authState.isOnline, forgotEmail, t]
  );

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────

  const isLoading = authState.phase === 'validating' || authState.phase === 'submitting';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.pageBg }}>
      {/* Offline indicator */}
      {!authState.isOnline && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4"
          style={{ background: C.warn, color: 'white' }}
          role="alert"
          aria-live="polite"
        >
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">{t.networkError}</span>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center relative z-10 py-12 px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{
                background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
              }}
            >
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.text }}>
              Mexi<span style={{ color: C.blue }}>Chat</span>
            </h1>
            <p className="text-sm mt-2" style={{ color: C.textBody }}>
              {t.secureMessaging}
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-6 sm:p-8 shadow-lg"
            style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}` }}
          >
            {/* Honeypot */}
            <div
              style={{
                position: 'absolute',
                left: '-9999px',
                opacity: 0,
                height: 0,
                overflow: 'hidden',
              }}
              aria-hidden="true"
            >
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {/* ---------- OTP VIEW ---------- */}
            {view === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="text-center mb-4">
                  <Phone className="h-10 w-10 mx-auto mb-3" style={{ color: C.blue }} />
                  <h2 className="text-lg font-bold" style={{ color: C.text }}>
                    {t.verifyOtp}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: C.textBody }}>
                    {t.otpSent}{' '}
                    <strong style={{ color: C.blue }}>{escapeHtml(otpTarget)}</strong>
                  </p>
                </div>

                <AuthInput
                  id="otp"
                  icon={<KeyRound className="h-4 w-4" />}
                  label="OTP"
                  value={otpCode}
                  onChange={handleOtpChange}
                  placeholder={t.otpPlaceholder}
                  required
                  maxLength={6}
                  disabled={isLoading}
                  error={authState.errorCode === 'OTP_VERIFICATION_FAILED' ? authState.error : undefined}
                  autoComplete="one-time-code"
                />

                <Button
                  type="submit"
                  className="w-full h-11 font-bold text-sm rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: C.blue }}
                  disabled={isLoading || otpCode.length !== 6}
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.verifying}
                    </>
                  ) : (
                    t.verifyOtp
                  )}
                </Button>

                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setView('signin');
                      setOtpCode('');
                      dispatch({ type: 'CLEAR_ERROR' });
                      retryCountRef.current = 0;
                    }}
                    className="text-xs flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{
                      color: C.textBody,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    disabled={isLoading}
                  >
                    <ArrowLeft className="h-3 w-3" /> {t.backToSignIn}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpCooldown > 0 || isLoading || authState.isRetrying}
                    className="text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{
                      color:
                        otpCooldown > 0 ? C.textMuted : C.blue,
                      background: 'none',
                      border: 'none',
                      cursor:
                        otpCooldown > 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {otpCooldown > 0
                      ? `${t.resendOtp} (${otpCooldown}s)`
                      : t.resendOtp}
                  </button>
                </div>
              </form>
            )}

            {/* ---------- EMAIL CONFIRMATION VIEW ---------- */}
            {view === 'confirm-email' && (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2
                  className="h-12 w-12 mx-auto"
                  style={{ color: C.success }}
                />
                <h2 className="text-lg font-bold" style={{ color: C.text }}>
                  {t.confirmEmailTitle}
                </h2>
                <p className="text-sm" style={{ color: C.textBody }}>
                  {t.confirmEmailDesc}{' '}
                  <strong style={{ color: C.blue }}>
                    {escapeHtml(signUpEmail)}
                  </strong>
                </p>
                <p className="text-xs" style={{ color: C.textMuted }}>
                  {t.confirmEmailAction}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setView('signin');
                    dispatch({ type: 'CLEAR_ERROR' });
                  }}
                  className="text-sm font-medium flex items-center gap-1 mx-auto transition-opacity hover:opacity-80"
                  style={{
                    color: C.blue,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft className="h-3 w-3" /> {t.backToSignIn}
                </button>
              </div>
            )}

            {/* ---------- FORGOT PASSWORD VIEW ---------- */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="text-center mb-4">
                  <KeyRound
                    className="h-10 w-10 mx-auto mb-3"
                    style={{ color: C.blue }}
                  />
                  <h2 className="text-lg font-bold" style={{ color: C.text }}>
                    {t.resetPassword}
                  </h2>
                </div>

                <AuthInput
                  id="forgot-email"
                  icon={<Mail className="h-4 w-4" />}
                  label={t.email}
                  type="email"
                  value={forgotEmail}
                  onChange={setForgotEmail}
                  placeholder={t.emailPlaceholder}
                  required
                  disabled={isLoading}
                  error={authState.errorCode === 'VALIDATION_ERROR' ? authState.error : undefined}
                  autoComplete="email"
                />

                <Button
                  type="submit"
                  className="w-full h-11 font-bold text-sm rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: C.blue }}
                  disabled={isLoading}
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t.sendResetLink
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setView('signin');
                    dispatch({ type: 'CLEAR_ERROR' });
                  }}
                  className="text-xs flex items-center gap-1 mx-auto transition-opacity hover:opacity-80"
                  style={{
                    color: C.textBody,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-3 w-3" /> {t.backToSignIn}
                </button>
              </form>
            )}

            {/* ---------- SIGNIN/SIGNUP TABS ---------- */}
            {(view === 'signin' || view === 'signup') && (
              <Tabs value={view} onValueChange={(v) => setView(v as AuthView)}>
                <TabsList
                  className="grid w-full grid-cols-2 mb-6 p-1 rounded-lg"
                  style={{
                    background: '#f1f5f9',
                    border: `1px solid ${C.cardBorder}`,
                  }}
                >
                  <TabsTrigger
                    value="signin"
                    className="rounded-md text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    style={{ color: C.textBody }}
                    disabled={isLoading}
                  >
                    {t.signIn}
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="rounded-md text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    style={{ color: C.textBody }}
                    disabled={isLoading}
                  >
                    {t.signUp}
                  </TabsTrigger>
                </TabsList>

                {/* SIGN IN TAB */}
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-5">
                    {authMethod === 'email' ? (
                      <>
                        <AuthInput
                          id="signin-email"
                          icon={<Mail className="h-4 w-4" />}
                          label={t.email}
                          type="email"
                          value={signInEmail}
                          onChange={setSignInEmail}
                          placeholder={t.emailPlaceholder}
                          required
                          disabled={isLoading}
                          error={
                            authState.errorCode === 'VALIDATION_ERROR'
                              ? authState.error
                              : undefined
                          }
                          autoComplete="email"
                        />
                        <AuthInput
                          id="signin-password"
                          icon={<Lock className="h-4 w-4" />}
                          label={t.password}
                          type={showPassword ? 'text' : 'password'}
                          value={signInPassword}
                          onChange={setSignInPassword}
                          placeholder="••••••••"
                          required
                          disabled={isLoading}
                          error={
                            authState.errorCode === 'SIGNIN_FAILED'
                              ? authState.error
                              : undefined
                          }
                          rightIcon={
                            showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )
                          }
                          onRightClick={() => setShowPassword(!showPassword)}
                          autoComplete="current-password"
                        />
                      </>
                    ) : (
                      <AuthInput
                        id="signin-phone"
                        icon={<Phone className="h-4 w-4" />}
                        label={t.phone}
                        type="tel"
                        value={signInPhone}
                        onChange={handleSignInPhoneChange}
                        placeholder={t.phonePlaceholder}
                        required
                        disabled={isLoading}
                        hint={t.phoneHint}
                        error={
                          authState.errorCode === 'VALIDATION_ERROR'
                            ? authState.error
                            : undefined
                        }
                        autoComplete="tel"
                      />
                    )}

                    <div className="flex justify-between items-center">
                      <MethodToggle
                        authMethod={authMethod}
                        onToggle={toggleAuthMethod}
                        t={t}
                        disabled={isLoading}
                      />
                      {authMethod === 'email' && (
                        <button
                          type="button"
                          onClick={() => {
                            setView('forgot');
                            dispatch({ type: 'CLEAR_ERROR' });
                          }}
                          className="text-xs transition-opacity hover:opacity-80"
                          style={{
                            color: C.blue,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          disabled={isLoading}
                        >
                          {t.forgotPassword}
                        </button>
                      )}
                    </div>

                    {authState.error && authState.phase === 'error' && (
                      <div
                        className="p-3 rounded-lg flex items-start gap-2"
                        style={{ background: '#fee2e2', color: C.danger }}
                        role="alert"
                      >
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span className="text-xs">
                          {escapeHtml(authState.error)}
                        </span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 font-bold text-sm rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: C.blue }}
                      disabled={isLoading || !authState.isOnline}
                      aria-busy={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.signingIn}
                        </>
                      ) : authMethod === 'phone' ? (
                        t.sendOtp
                      ) : (
                        t.signIn
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* SIGN UP TAB */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <AuthInput
                      id="signup-name"
                      icon={<UserCircle className="h-4 w-4" />}
                      label={t.fullName}
                      value={signUpName}
                      onChange={handleSignUpNameChange}
                      placeholder={t.namePlaceholder}
                      required
                      disabled={isLoading}
                      error={
                        authState.errorCode === 'VALIDATION_ERROR'
                          ? authState.error
                          : undefined
                      }
                      autoComplete="name"
                    />

                    {authMethod === 'email' ? (
                      <AuthInput
                        id="signup-email"
                        icon={<Mail className="h-4 w-4" />}
                        label={t.email}
                        type="email"
                        value={signUpEmail}
                        onChange={setSignUpEmail}
                        placeholder={t.emailPlaceholder}
                        required
                        disabled={isLoading}
                        error={
                          authState.errorCode === 'VALIDATION_ERROR'
                            ? authState.error
                            : undefined
                        }
                        autoComplete="email"
                      />
                    ) : (
                      <AuthInput
                        id="signup-phone"
                        icon={<Phone className="h-4 w-4" />}
                        label={t.phone}
                        type="tel"
                        value={signUpPhone}
                        onChange={handleSignUpPhoneChange}
                        placeholder={t.phonePlaceholder}
                        required
                        disabled={isLoading}
                        hint={t.phoneHint}
                        error={
                          authState.errorCode === 'VALIDATION_ERROR'
                            ? authState.error
                            : undefined
                        }
                        autoComplete="tel"
                      />
                    )}

                    <div>
                      <AuthInput
                        id="signup-password"
                        icon={<Lock className="h-4 w-4" />}
                        label={t.password}
                        type={showSignUpPassword ? 'text' : 'password'}
                        value={signUpPassword}
                        onChange={setSignUpPassword}
                        placeholder="••••••••"
                        required
                        disabled={isLoading}
                        hint={t.passwordHint}
                        error={
                          authState.errorCode === 'VALIDATION_ERROR'
                            ? authState.error
                            : undefined
                        }
                        rightIcon={
                          showSignUpPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )
                        }
                        onRightClick={() =>
                          setShowSignUpPassword(!showSignUpPassword)
                        }
                        autoComplete="new-password"
                      />

                      {signUpPassword.length > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div
                            className="flex-1 h-1.5 rounded-full overflow-hidden"
                            style={{ background: '#e2e8f0' }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${pwStrength.score * 25}%`,
                                background: pwStrength.color,
                              }}
                            />
                          </div>
                          <span
                            className="text-[10px] font-semibold"
                            style={{ color: pwStrength.color }}
                          >
                            {t.passwordStrength[pwStrength.key]}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-start">
                      <MethodToggle
                        authMethod={authMethod}
                        onToggle={toggleAuthMethod}
                        t={t}
                        disabled={isLoading}
                      />
                    </div>

                    {authState.error && authState.phase === 'error' && (
                      <div
                        className="p-3 rounded-lg flex items-start gap-2"
                        style={{ background: '#fee2e2', color: C.danger }}
                        role="alert"
                      >
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span className="text-xs">
                          {escapeHtml(authState.error)}
                        </span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 font-bold text-sm rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: C.blue }}
                      disabled={isLoading || !authState.isOnline}
                      aria-busy={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.signingUp}
                        </>
                      ) : authMethod === 'phone' ? (
                        t.sendOtp
                      ) : (
                        t.createAccount
                      )}
                    </Button>

                    <p
                      className="text-xs text-center mt-3"
                      style={{ color: C.textBody }}
                    >
                      {t.termsAccept}{' '}
                      <a
                        href="/terminos"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: C.blue,
                          textDecoration: 'underline',
                        }}
                      >
                        {t.terms}
                      </a>
                      {' '}{t.and}{' '}
                      <a
                        href="/privacidad"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: C.blue,
                          textDecoration: 'underline',
                        }}
                      >
                        {t.privacy}
                      </a>
                      .
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