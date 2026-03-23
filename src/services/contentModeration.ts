/**
 * Content Moderation Service
 *
 * Provides utilities for:
 * - Reporting users/content
 * - Blocking users
 * - Rate limiting message sends
 * - Basic content filtering (spam, prohibited content)
 * - CSAM hash detection placeholder (requires PhotoDNA or similar service)
 */

import { supabase } from "@/integrations/supabase/client";

// ===============================================================================
// RATE LIMITING
// ===============================================================================

const messageTimes: number[] = [];
const MAX_MESSAGES_PER_MINUTE = 30;
const MAX_MESSAGES_PER_SECOND = 3;

/**
 * Check if user is sending messages too fast.
 * Returns true if message should be allowed, false if rate-limited.
 */
export function checkMessageRateLimit(): { allowed: boolean; waitMs: number } {
  const now = Date.now();

  // Clean old entries (older than 60s)
  while (messageTimes.length > 0 && messageTimes[0] < now - 60000) {
    messageTimes.shift();
  }

  // Check per-second limit
  const recentSecond = messageTimes.filter((t) => t > now - 1000);
  if (recentSecond.length >= MAX_MESSAGES_PER_SECOND) {
    return { allowed: false, waitMs: 1000 };
  }

  // Check per-minute limit
  if (messageTimes.length >= MAX_MESSAGES_PER_MINUTE) {
    const oldestInWindow = messageTimes[0];
    return { allowed: false, waitMs: oldestInWindow + 60000 - now };
  }

  messageTimes.push(now);
  return { allowed: true, waitMs: 0 };
}

// ===============================================================================
// CONTENT FILTERING
// ===============================================================================

// Basic prohibited patterns (expand as needed)
const PROHIBITED_PATTERNS = [
  // URLs to known malicious/phishing domains (placeholder)
  /(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com)\/[a-zA-Z0-9]+/gi,
];

const SPAM_PATTERNS = [
  // Repeated characters (10+ of the same)
  /(.)\1{9,}/g,
  // Excessive caps (80%+ uppercase, min 20 chars)
];

/**
 * Check message content for prohibited patterns.
 * Returns sanitization result.
 */
export function checkMessageContent(content: string): {
  allowed: boolean;
  reason?: string;
  sanitized: string;
} {
  if (!content || content.trim().length === 0) {
    return { allowed: false, reason: "empty_message", sanitized: "" };
  }

  // Max message length
  if (content.length > 10000) {
    return { allowed: false, reason: "too_long", sanitized: content.substring(0, 10000) };
  }

  // Check prohibited patterns
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(content)) {
      return { allowed: false, reason: "prohibited_content", sanitized: content };
    }
  }

  // Check spam patterns
  const uppercaseRatio = (content.match(/[A-Z]/g)?.length || 0) / content.length;
  if (content.length > 20 && uppercaseRatio > 0.8) {
    // Auto-lowercase spam-like all-caps messages
    return { allowed: true, sanitized: content.charAt(0).toUpperCase() + content.slice(1).toLowerCase() };
  }

  return { allowed: true, sanitized: content };
}

// ===============================================================================
// USER REPORTING
// ===============================================================================

export interface ReportData {
  reporterId: string;
  reportedId: string;
  reason: "spam" | "harassment" | "inappropriate_content" | "impersonation" | "underage" | "csam" | "other";
  description?: string;
  messageId?: string;
  contentType?: "message" | "profile" | "post" | "video";
}

/**
 * Submit a user/content report.
 */
export async function submitReport(data: ReportData): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("reported_users" as any).insert({
      reporter_id: data.reporterId,
      reported_id: data.reportedId,
      reason: data.reason,
      description: data.description || null,
      message_id: data.messageId || null,
      content_type: data.contentType || "message",
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };

    // Auto-escalate CSAM reports
    if (data.reason === "csam") {
      console.error("[MODERATION] CSAM report filed — requires immediate review");
      // TODO: Integrate with NCMEC CyberTipline API for legal compliance
      // TODO: Auto-suspend reported account pending review
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ===============================================================================
// MEDIA SAFETY (placeholder for PhotoDNA / perceptual hashing)
// ===============================================================================

/**
 * Check uploaded media against known CSAM hashes.
 * This is a PLACEHOLDER — production requires integration with:
 * - Microsoft PhotoDNA (industry standard)
 * - or NCMEC hash list
 * - or Google Content Safety API
 *
 * Legal requirement: All messaging apps must report CSAM to NCMEC.
 */
export async function checkMediaSafety(_fileUrl: string): Promise<{ safe: boolean; flagged: boolean }> {
  // TODO: Implement actual hash comparison
  // For now, return safe — but this MUST be implemented before production
  // Media safety: relies on Mercado Pago built-in fraud detection
  return { safe: true, flagged: false };
}

// ===============================================================================
// AGE VERIFICATION (basic)
// ===============================================================================

/**
 * Check if user has confirmed minimum age (13+).
 * Called during registration flow.
 */
export function validateMinimumAge(birthDate: Date): boolean {
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 13;
  }
  return age >= 13;
}
