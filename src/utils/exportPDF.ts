/**
 * MEXICHAT — PDF Chat Export
 * Generates a styled PDF from chat messages using pure JS (no dependencies).
 * Creates a printable HTML document and uses browser print-to-PDF.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function exportChatPDF(
  scopeType: 'conversation' | 'group',
  scopeId: string,
  scopeName: string,
  currentUserId: string,
) {
  toast.loading('Generando PDF...', { id: 'pdf-export' });

  try {
    const table = scopeType === 'conversation' ? 'private_messages' : 'group_messages';
    const column = scopeType === 'conversation' ? 'conversation_id' : 'group_id';

    const { data: messages } = await supabase.from(table)
      .select('id, sender_id, content, media_url, media_type, created_at')
      .eq(column, scopeId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      toast.dismiss('pdf-export');
      toast.info('No hay mensajes para exportar');
      return;
    }

    const senderIds = [...new Set(messages.map(m => String((m as any).sender_id)))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', senderIds);
    const nameMap = new Map<string, string>();
    if (profiles) profiles.forEach((p: any) => nameMap.set(String(p.id), String(p.full_name ?? 'Usuario')));

    // Group by date
    const grouped = new Map<string, typeof messages>();
    for (const m of messages) {
      const dateKey = new Date(String((m as any).created_at)).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(m);
    }

    let messagesHtml = '';
    for (const [dateKey, msgs] of grouped) {
      messagesHtml += `<div class="date-divider"><span>${dateKey}</span></div>`;
      for (const m of msgs) {
        const row = m as any;
        const isSent = row.sender_id === currentUserId;
        const sender = nameMap.get(String(row.sender_id)) ?? 'Usuario';
        const time = new Date(String(row.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const content = String(row.content ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const isLocation = row.media_type === 'location';

        let mediaHtml = '';
        if (isLocation) {
          try {
            const loc = JSON.parse(content);
            mediaHtml = `<div class="location">📍 Ubicacion: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}</div>`;
          } catch { mediaHtml = `<div class="location">📍 Ubicacion</div>`; }
        } else if (row.media_url) {
          if (row.media_type === 'image') mediaHtml = `<div class="media"><img src="${row.media_url}" /></div>`;
          else mediaHtml = `<div class="media">[📎 ${row.media_type || 'archivo'}]</div>`;
        }

        messagesHtml += `
          <div class="msg ${isSent ? 'sent' : 'received'}">
            <div class="sender">${sender}</div>
            ${mediaHtml}
            ${!isLocation ? `<div class="content">${content || ''}</div>` : ''}
            <div class="time">${time}</div>
          </div>`;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Chat: ${scopeName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #e5ddd5; padding: 20px; }
  .header { background: #1d4ed8; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0; margin-bottom: 0; }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; }
  .chat-body { background: #e5ddd5; padding: 20px; }
  .date-divider { text-align: center; margin: 16px 0; }
  .date-divider span { background: rgba(255,255,255,0.9); padding: 4px 14px; border-radius: 8px; font-size: 11px; color: #555; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
  .msg { max-width: 65%; padding: 8px 12px; margin: 3px 0; border-radius: 8px; position: relative; page-break-inside: avoid; }
  .msg.sent { margin-left: auto; background: #dcf8c6; border-bottom-right-radius: 2px; }
  .msg.received { margin-right: auto; background: white; border-bottom-left-radius: 2px; box-shadow: 0 1px 1px rgba(0,0,0,0.06); }
  .sender { font-size: 11px; font-weight: 700; color: #1d4ed8; margin-bottom: 2px; }
  .msg.sent .sender { color: #075e54; }
  .content { font-size: 13px; line-height: 1.4; color: #111; word-wrap: break-word; }
  .time { font-size: 10px; color: #888; text-align: right; margin-top: 2px; }
  .media img { max-width: 200px; border-radius: 6px; margin: 4px 0; }
  .media { font-size: 12px; color: #555; margin: 4px 0; }
  .location { font-size: 12px; color: #1d4ed8; padding: 6px 8px; background: rgba(29,78,216,0.06); border-radius: 6px; margin: 4px 0; }
  .footer { text-align: center; padding: 16px; font-size: 11px; color: #888; border-top: 1px solid #ddd; margin-top: 20px; }
  @media print { body { background: white; padding: 0; } .chat-body { background: #f0f0f0; } }
</style>
</head>
<body>
  <div class="header">
    <h1>💬 ${scopeName}</h1>
    <p>${messages.length} mensajes · Exportado ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>
  <div class="chat-body">${messagesHtml}</div>
  <div class="footer">Exportado desde MexiChat · ${new Date().toLocaleString()}</div>
</body>
</html>`;

    // Open in new window for print-to-PDF
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      // Auto-trigger print dialog after load
      win.onload = () => { setTimeout(() => win.print(), 500); };
    } else {
      // Fallback: download as HTML
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_${scopeName.replace(/[^a-z0-9]/gi, '_')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }

    toast.dismiss('pdf-export');
    toast.success(`Chat exportado (${messages.length} mensajes)`);
  } catch (err) {
    toast.dismiss('pdf-export');
    toast.error('Error al exportar PDF');
    console.error('[PDF Export]', err);
  }
}