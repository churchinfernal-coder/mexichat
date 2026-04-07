import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, AlertTriangle, User, Clock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

type ReportStatus = 'pending' | 'reviewed' | 'action_taken' | 'dismissed';

interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  reporter_name?: string;
  reported_name?: string;
  reporter_avatar?: string;
  reported_avatar?: string;
  report_count?: number;
}

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:      { label: 'Pendiente',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: <Clock size={14} /> },
  reviewed:     { label: 'Revisado',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   icon: <CheckCircle size={14} /> },
  action_taken: { label: 'Accion tomada', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    icon: <Shield size={14} /> },
  dismissed:    { label: 'Descartado',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  icon: <XCircle size={14} /> },
};

const REASON_LABELS: Record<string, string> = {
  csam: 'Explotacion menores', extortion: 'Extorsion', terrorism: 'Terrorismo', human_trafficking: 'Trata de personas',
  self_harm: 'Autolesion', fraud: 'Fraude', identity_theft: 'Suplantacion', doxxing: 'Doxxing',
  revenge_porn: 'Porno no consentido', drug_sales: 'Venta drogas', weapons: 'Armas',
  harassment: 'Acoso', hate_speech: 'Discurso de odio', threats: 'Amenazas', underage: 'Menor de edad',
  sexual_harassment: 'Acoso sexual', spam: 'Spam', fake_profile: 'Perfil falso',
  inappropriate: 'Contenido inapropiado', other: 'Otro', scam: 'Estafa',
  impersonation: 'Suplantacion', violence: 'Violencia',
};

const SEVERITY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICO', color: '#dc2626', bg: 'rgba(220,38,38,0.15)' },
  high: { label: 'ALTO', color: '#ea580c', bg: 'rgba(234,88,12,0.15)' },
  medium: { label: 'MEDIO', color: '#d97706', bg: 'rgba(217,119,6,0.15)' },
  low: { label: 'BAJO', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
};

function parseSeverity(details: string | null, reason: string): string {
  if (details) {
    try { var d = JSON.parse(details); if (d.severity) return d.severity; } catch {}
  }
  var r = reason.toLowerCase();
  if (r.includes('csam') || r.includes('extortion') || r.includes('terrorism') || r.includes('trafficking') || r.includes('self_harm')) return 'critical';
  if (r.includes('fraud') || r.includes('identity') || r.includes('doxxing') || r.includes('revenge') || r.includes('drug') || r.includes('weapon')) return 'high';
  if (r.includes('harassment') || r.includes('hate') || r.includes('threat') || r.includes('underage') || r.includes('sexual')) return 'medium';
  return 'low';
}

export default function AdminReports() {
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('pending');
  const [stats, setStats] = useState({ pending: 0, reviewed: 0, action_taken: 0, dismissed: 0, total: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('reported_users' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter !== 'all') query = query.eq('status', filter);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as any[];

      // Load profile names
      const userIds = [...new Set(rows.flatMap(r => [r.reporter_id, r.reported_id]))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Count reports per reported user
      const countMap = new Map<string, number>();
      rows.forEach(r => countMap.set(r.reported_id, (countMap.get(r.reported_id) || 0) + 1));

      const mapped: Report[] = rows.map(r => ({
        ...r,
        reporter_name: profileMap.get(r.reporter_id)?.full_name || profileMap.get(r.reporter_id)?.username || 'Desconocido',
        reported_name: profileMap.get(r.reported_id)?.full_name || profileMap.get(r.reported_id)?.username || 'Desconocido',
        reporter_avatar: profileMap.get(r.reporter_id)?.avatar_url,
        reported_avatar: profileMap.get(r.reported_id)?.avatar_url,
        report_count: countMap.get(r.reported_id) || 1,
      }));

      setReports(mapped);

      // Stats
      const all = rows.length > 0 ? rows : [];
      const { data: allData } = await supabase.from('reported_users' as any).select('status');
      const allRows = (allData || []) as any[];
      setStats({
        pending: allRows.filter(r => r.status === 'pending').length,
        reviewed: allRows.filter(r => r.status === 'reviewed').length,
        action_taken: allRows.filter(r => r.status === 'action_taken').length,
        dismissed: allRows.filter(r => r.status === 'dismissed').length,
        total: allRows.length,
      });
    } catch (err: any) {
      toast.error('Error cargando reportes: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const updateStatus = useCallback(async (reportId: string, newStatus: ReportStatus, notes?: string) => {
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      };
      if (notes) updateData.admin_notes = notes;

      const { error } = await supabase
        .from('reported_users' as any)
        .update(updateData)
        .eq('id', reportId);

      if (error) throw error;
      toast.success(`Reporte marcado como: ${STATUS_CONFIG[newStatus].label}`);
      loadReports();
      setExpandedId(null);
      setAdminNote('');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  }, [loadReports]);

  const banUser = useCallback(async (userId: string, reportId: string) => {
    try {
      // Mark all pending reports for this user as action_taken
      await supabase
        .from('reported_users' as any)
        .update({ status: 'action_taken', admin_notes: 'Usuario baneado', reviewed_at: new Date().toISOString() })
        .eq('reported_id', userId)
        .eq('status', 'pending');

      // Block user by setting a flag in profiles
      await supabase.from('profiles').update({ is_banned: true } as any).eq('id', userId);

      toast.success('Usuario baneado y reportes cerrados');
      loadReports();
    } catch (err: any) {
      toast.error('Error baneando usuario: ' + err.message);
    }
  }, [loadReports]);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Shield size={24} style={{ color: '#f59e0b' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Panel de Reportes</h1>
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#94a3b8' }}>{stats.total} reportes totales</span>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', flexWrap: 'wrap' }}>
        {(['all', 'pending', 'reviewed', 'action_taken', 'dismissed'] as const).map(f => {
          const count = f === 'all' ? stats.total : stats[f];
          const cfg = f === 'all' ? { label: 'Todos', color: '#e2e8f0', bg: 'rgba(226,232,240,0.1)' } : STATUS_CONFIG[f];
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: filter === f ? `2px solid ${cfg.color}` : '1px solid #334155',
                background: filter === f ? cfg.bg : 'transparent', color: cfg.color, cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
              }}>
              {cfg.label} <span style={{ background: cfg.bg, padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Reports List */}
      <div style={{ padding: '0 24px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Cargando reportes...</div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <Shield size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>No hay reportes {filter !== 'all' ? STATUS_CONFIG[filter as ReportStatus].label.toLowerCase() : ''}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reports.map(r => {
              const cfg = STATUS_CONFIG[r.status];
              const isExpanded = expandedId === r.id;
              return (
                <div key={r.id} style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                  <div onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Reported user avatar */}
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#334155', overflow: 'hidden', flexShrink: 0 }}>
                      {r.reported_avatar ? <img src={r.reported_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} style={{ margin: '10px', color: '#64748b' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.reported_name}</span>
                        {(r.report_count ?? 0) >= 3 && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>x{r.report_count} reportes</span>}
                        <span style={{ ...cfg, background: cfg.bg, color: cfg.color, padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        Reportado por: {r.reporter_name} | {REASON_LABELS[r.reason?.replace(/\[|\]/g,'').split(']')[0]?.trim() || ''] || r.reason} | {new Date(r.created_at).toLocaleDateString('es-MX')}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {(() => { const sev = parseSeverity(r.details, r.reason); const badge = SEVERITY_BADGE[sev]; return badge ? <span style={{ background: badge.bg, color: badge.color, padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>{badge.label}</span> : null; })()}
                        {(() => { try { const d = JSON.parse(r.details || '{}'); return d.evidence_count > 0 ? <span style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600 }}>{d.evidence_count} evidencia(s)</span> : null; } catch { return null; } })()}
                      </div>
                    </div>
                    <ChevronDown size={18} style={{ color: '#64748b', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 18px 16px', borderTop: '1px solid #334155' }}>
                      {r.details && <div style={{ padding: '12px', background: '#0f172a', borderRadius: '8px', margin: '12px 0', fontSize: '13px', color: '#cbd5e1' }}>{r.details}</div>}
                      {r.admin_notes && <div style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', margin: '8px 0', fontSize: '12px', color: '#93c5fd' }}>Nota admin: {r.admin_notes}</div>}

                      <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Nota del admin (opcional)..."
                        style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', marginTop: '8px', resize: 'vertical', minHeight: '60px' }} />

                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {r.status === 'pending' && (
                          <>
                            <button onClick={() => updateStatus(r.id, 'reviewed', adminNote)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Marcar Revisado</button>
                            <button onClick={() => updateStatus(r.id, 'action_taken', adminNote)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Accion Tomada</button>
                            <button onClick={() => updateStatus(r.id, 'dismissed', adminNote)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Descartar</button>
                            <button onClick={() => banUser(r.reported_id, r.id)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Banear Usuario</button>
                          </>
                        )}
                        {r.status !== 'pending' && (
                          <button onClick={() => updateStatus(r.id, 'pending', '')} style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Reabrir</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}