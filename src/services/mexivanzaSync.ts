/**
 * MEXIVANZA — Auto-signup sync
 *
 * When a user signs up on MexiChat, also create their account on MexiVanza.
 * When a user signs in on MexiChat, also sign them in on MexiVanza so they
 * can interact with community data (like, comment, post).
 *
 * Failures are silently logged — MexiChat signup must never break because
 * the MexiVanza side failed.
 */

import { mexivanza } from '@/integrations/mexivanza/client';

/**
 * Register the user on MexiVanza with the same email/password.
 * If the user already exists there, this is a no-op (Supabase returns
 * "User already registered" which we ignore).
 */
export async function syncSignUpToMexivanza(
  email: string,
  password: string,
  fullName: string,
): Promise<void> {
  try {
    const { error } = await mexivanza.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          source: 'mexichat',
        },
      },
    });

    if (error) {
      // "User already registered" is fine — they already have a MexiVanza account
      if (error.message?.includes('already registered')) {
        console.log('[MexiVanza] User already exists — skipping signup');
        return;
      }
      console.warn('[MexiVanza] Signup sync failed:', error.message);
    } else {
      console.log('[MexiVanza] ✅ User auto-registered on MexiVanza');
    }
  } catch (err) {
    console.warn('[MexiVanza] Signup sync error:', err);
  }
}

/**
 * Sign the user into MexiVanza so they get a session for interacting
 * with community features (likes, comments, posts).
 */
export async function syncSignInToMexivanza(
  email: string,
  password: string,
): Promise<void> {
  try {
    const { error } = await mexivanza.auth.signInWithPassword({ email, password });
    if (error) {
      // User might not exist on MexiVanza yet — try auto-registering
      if (error.message?.includes('Invalid login')) {
        console.log('[MexiVanza] User not found on MexiVanza — auto-registering');
        await syncSignUpToMexivanza(email, password, '');
        // Try sign-in again after registration
        await mexivanza.auth.signInWithPassword({ email, password });
      } else {
        console.warn('[MexiVanza] SignIn sync failed:', error.message);
      }
    } else {
      console.log('[MexiVanza] ✅ Signed in to MexiVanza');
    }
  } catch (err) {
    console.warn('[MexiVanza] SignIn sync error:', err);
  }
}
