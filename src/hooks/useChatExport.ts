import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ExportFormat = 'txt' | 'json' | 'csv';

export function useChatExport() {
  const [exporting, setExporting] = useState(false);

  const exportChat = useCallback(async (
    scopeType: 'conversation' | 'group',
    scopeId: string,
    scopeName: string,
    format: ExportFormat = 'txt',
  ) => {
    setExporting(true);
    try {
      const table = scopeType === 'conversation' ? 'private_messages' : 'group_messages';
      const column = scopeType === 'conversation' ? 'conversation_id' : 'group_id';

      const { data: messages } = await supabase.from(table)
        .select('id, sender_id, content, media_url, media_type, created_at')
        .eq(column, scopeId)
        .order('created_at', { ascending: true });

      if (!messages || messages.length === 0) { toast.info('No hay mensajes para exportar'); return; }

      const senderIds = [...new Set(messages.map(m => String((m as Record<string, unknown>).sender_id)))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
      const nameMap = new Map<string, string>();
      if (profiles) profiles.forEach(p => nameMap.set(String((p as Record<string, unknown>).id), String((p as Record<string, unknown>).full_name ?? 'Usuario')));

      let output = '';
      const fileName = `chat_${scopeName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'txt') {
        output = `Chat Export: ${scopeName}\nExported: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n`;
        for (const m of messages) {
          const row = m as Record<string, unknown>;
          const date = new Date(String(row.created_at)).toLocaleString();
          const sender = nameMap.get(String(row.sender_id)) ?? 'Usuario';
          const content = String(row.content ?? '');
          const media = row.media_url ? ` [📎 ${row.media_type || 'archivo'}]` : '';
          output += `[${date}] ${sender}: ${content}${media}\n`;
        }
      } else if (format === 'json') {
        const jsonData = messages.map(m => {
          const row = m as Record<string, unknown>;
          return {
            id: row.id,
            sender: nameMap.get(String(row.sender_id)) ?? 'Usuario',
            content: row.content,
            media_url: row.media_url,
            media_type: row.media_type,
            created_at: row.created_at,
          };
        });
        output = JSON.stringify({ chat: scopeName, exported: new Date().toISOString(), messages: jsonData }, null, 2);
      } else if (format === 'csv') {
        output = 'Date,Sender,Content,Media\n';
        for (const m of messages) {
          const row = m as Record<string, unknown>;
          const date = new Date(String(row.created_at)).toLocaleString();
          const sender = nameMap.get(String(row.sender_id)) ?? 'Usuario';
          const content = String(row.content ?? '').replace(/"/g, '""');
          const media = row.media_url ? String(row.media_url) : '';
          output += `"${date}","${sender}","${content}","${media}"\n`;
        }
      }

      const blob = new Blob([output], { type: format === 'json' ? 'application/json' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Chat exportado (${messages.length} mensajes)`);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, exportChat };
}