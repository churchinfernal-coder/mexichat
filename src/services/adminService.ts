/**
 * Admin Service -- resolves admin user, auto-friend on signup,
 * automated welcome menu, and auto-responder.
 *
 * Admin is resolved by phone number at runtime (never hardcoded UUID).
 * All operations are fire-and-forget with error isolation.
 */

import { supabase } from '@/integrations/supabase/client';

// ===============================================================================
// ADMIN RESOLUTION -- by phone number, cached
// ===============================================================================

const ADMIN_PHONE = '7778003049';
let cachedAdminId: string | null = null;

export async function getAdminUserId(): Promise<string | null> {
  if (cachedAdminId) return cachedAdminId;

  try {
    // Try phone match first
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', ADMIN_PHONE)
      .maybeSingle();

    if (data?.id) {
      cachedAdminId = data.id;
      return cachedAdminId;
    }

    // Fallback: try phone with country code variants
    const variants = [ADMIN_PHONE, `+52${ADMIN_PHONE}`, `52${ADMIN_PHONE}`, `+1${ADMIN_PHONE}`];
    for (const v of variants) {
      const { data: row } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', v)
        .maybeSingle();
      if (row?.id) {
        cachedAdminId = row.id;
        return cachedAdminId;
      }
    }

    console.warn('[AdminService] Admin user not found by phone:', ADMIN_PHONE);
    return null;
  } catch (err) {
    console.error('[AdminService] Error resolving admin:', err);
    return null;
  }
}

// ===============================================================================
// WELCOME MESSAGE -- the automated menu
// ===============================================================================

const WELCOME_MESSAGE = [
  'Hola! Gracias por contactar a la administracion de MexiChat/MexiVanza.',
  '',
  'En que podemos ayudarte?',
  '',
  '1. Experiencia de viaje personalizada',
  '2. Asistencia legal',
  '3. Asistencia con publicidad',
  '4. Reportar abuso, fraude o crimen',
  '5. Asistencia con cualquier otra cosa',
  '',
  'Responde con el numero de tu opcion.',
].join('\n');

// ===============================================================================
// AUTO-RESPONSES -- per menu option
// ===============================================================================

const AUTO_RESPONSES: Record<string, string> = {
  '1': [
    'Excelente! Te interesa una experiencia de viaje personalizada.',
    '',
    'Un agente de viajes se pondra en contacto contigo pronto.',
    'Mientras tanto, puedes explorar nuestros paquetes de viaje en la seccion Viajes de Comunidad.',
    '',
    'Horario de atencion: Lunes a Viernes, 9:00 AM - 6:00 PM (hora de Mexico).',
  ].join('\n'),
  '2': [
    'Entendido. Necesitas asistencia legal.',
    '',
    'Un representante legal se comunicara contigo en las proximas 24 horas.',
    'Si es una emergencia, por favor llama al 911.',
    '',
    'Tu privacidad y seguridad son nuestra prioridad.',
  ].join('\n'),
  '3': [
    'Perfecto! Te interesa publicidad en MexiVanza.',
    '',
    'Ofrecemos espacios publicitarios para negocios y emprendedores.',
    'Un asesor comercial te contactara para darte mas informacion sobre planes y precios.',
    '',
    'Mientras tanto, visita la seccion Meximart para ver ejemplos de listados.',
  ].join('\n'),
  '4': [
    'Lamentamos que hayas tenido una mala experiencia.',
    '',
    'Tu reporte sera revisado por nuestro equipo de seguridad en las proximas 24 horas.',
    'Si estas en peligro inmediato, por favor contacta a las autoridades locales (911).',
    '',
    'Toda la informacion sera tratada de manera confidencial.',
  ].join('\n'),
  '5': [
    'Con gusto te ayudamos!',
    '',
    'Por favor describe tu consulta y un miembro del equipo te respondera lo antes posible.',
    '',
    'Horario de atencion: Lunes a Viernes, 9:00 AM - 6:00 PM (hora de Mexico).',
    'Fuera de horario, tu mensaje sera atendido el siguiente dia habil.',
  ].join('\n'),
};

// ===============================================================================
// FIND OR CREATE CONVERSATION -- between two users
// ===============================================================================

export async function findOrCreateConversation(
  userId1: string,
  userId2: string
): Promise<string | null> {
  try {
    // Check existing conversation in both directions
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(user_1.eq.${userId1},user_2.eq.${userId2}),and(user_1.eq.${userId2},user_2.eq.${userId1})`
      )
      .maybeSingle();

    if (existing?.id) return existing.id;

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        user_1: userId1,
        user_2: userId2,
        status: 'active',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[AdminService] Error creating conversation:', error);
      return null;
    }

    return newConv?.id ?? null;
  } catch (err) {
    console.error('[AdminService] findOrCreateConversation error:', err);
    return null;
  }
}

// ===============================================================================
// SEND MESSAGE -- insert into private_messages + update conversation
// ===============================================================================

async function sendSystemMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const { error: msgErr } = await supabase
      .from('private_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        is_read: false,
      });

    if (msgErr) {
      console.error('[AdminService] Error sending message:', msgErr);
      return false;
    }

    // Update conversation last_message
    await supabase
      .from('conversations')
      .update({
        last_message: content.substring(0, 100),
        last_message_at: now,
      })
      .eq('id', conversationId);

    return true;
  } catch (err) {
    console.error('[AdminService] sendSystemMessage error:', err);
    return false;
  }
}

// ===============================================================================
// AUTO-FRIEND + WELCOME -- called on signup
// ===============================================================================

export async function autoFriendAdmin(newUserId: string): Promise<void> {
  try {
    const adminId = await getAdminUserId();
    if (!adminId || adminId === newUserId) return;

    // 1. Add mutual contacts (both directions)
    await supabase.from('contacts').upsert(
      { user_id: newUserId, contact_user_id: adminId, nickname: 'MexiChat Admin' },
      { onConflict: 'user_id,contact_user_id' }
    ).then(() => {});

    await supabase.from('contacts').upsert(
      { user_id: adminId, contact_user_id: newUserId },
      { onConflict: 'user_id,contact_user_id' }
    ).then(() => {});

    // 2. Create or find conversation
    const convId = await findOrCreateConversation(newUserId, adminId);
    if (!convId) return;

    // 3. Send welcome message from admin
    await sendSystemMessage(convId, adminId, WELCOME_MESSAGE);

    console.log('[AdminService] Auto-friend + welcome sent for user:', newUserId);
  } catch (err) {
    console.error('[AdminService] autoFriendAdmin error:', err);
  }
}

// ===============================================================================
// AUTO-RESPONDER -- processes numbered replies
// ===============================================================================

export async function processAutoResponse(
  conversationId: string,
  senderId: string,
  content: string
): Promise<boolean> {
  try {
    const adminId = await getAdminUserId();
    if (!adminId || senderId === adminId) return false;

    // Check if this conversation involves admin
    const { data: conv } = await supabase
      .from('conversations')
      .select('user_1,user_2')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conv) return false;

    const isAdminConv =
      (conv.user_1 as string) === adminId || (conv.user_2 as string) === adminId;
    if (!isAdminConv) return false;

    // Check if the message is a menu selection (1-5)
    const trimmed = content.trim();
    const response = AUTO_RESPONSES[trimmed];
    if (!response) return false;

    // Small delay to feel natural
    await new Promise((r) => setTimeout(r, 1500));

    await sendSystemMessage(conversationId, adminId, response);
    return true;
  } catch (err) {
    console.error('[AdminService] processAutoResponse error:', err);
    return false;
  }
}

// ===============================================================================
// OPEN DM WITH USER -- for "Contactar" button
// ===============================================================================

export async function openDirectMessage(
  myUserId: string,
  targetUserId: string
): Promise<string | null> {
  if (!myUserId || !targetUserId) return null;

  try {
    // Ensure contact exists
    await supabase.from('contacts').upsert(
      { user_id: myUserId, contact_user_id: targetUserId },
      { onConflict: 'user_id,contact_user_id' }
    ).then(() => {});

    // Find or create conversation
    const convId = await findOrCreateConversation(myUserId, targetUserId);
    return convId;
  } catch (err) {
    console.error('[AdminService] openDirectMessage error:', err);
    return null;
  }
}
