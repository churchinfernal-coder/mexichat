/**
 * MEXICHAT — Community Blacklist / Report Board
 * Member-protected page: any authenticated user can view reported users.
 * Shows aggregated reports with search, filters, severity indicators.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Shield, Search, AlertTriangle, User, ChevronDown, ArrowLeft, Filter, Clock, Eye, Ban } from 'lucide-react';

interface ReportedUser {
  userId: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  reportCount: number;
  lastReportedAt: string;
  categories: string[];
  isBanned: boolean;
  latestStatus: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  spam: 'Spam', harassment: 'Acoso', fake: 'Perfil falso', underage: 'Menor de edad',
  scam: 'Estafa', csam: 'CSAM', extortion: 'Extorsion', terrorism: 'Terrorismo',
  fraud: 'Fraude', threats: 'Amenazas', hate_speech: 'Discurso de odio',
  drug_sales: 'Drogas', weapons: 'Armas', doxxing: 'Doxxing',
  identity_theft: 'Suplantacion', sexual_harassment: 'Acoso sexual',
  self_harm: 'Autolesion', human_trafficking: 'Trata de personas',
  revenge_porn: 'Porno NC', inappropriate: 'Inapropiado',
  fake_profile: 'Perfil falso', other: 'Otro',
};

function extractCategory(reason: string): string {
  const match = reason.match(/^\[([^\]]+)\]/);
  return match ? match[1] : reason;
}

export default function Reportes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reportedUsers, setReportedUsers] = useState<ReportedUser[]>([]);
  const [filtered, setFiltered] = useState<ReportedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'reports' | 'recent'>('reports');
  const [minReports, setMinReports] = useState(1);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userReports, setUserReports] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalReported: 0, totalReports: 0, banned: 0 });

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data: allReports } = await supabase.from('reported_users' as any)
        .select('*').order('created_at', { ascending: false }).limit(1000);

      if (!allReports || allReports.length === 0) {
        setReportedUsers([]); setFiltered([]); setLoading(false); return;
      }

      // Aggregate by reported user
      const userMap = new Map<string, { reports: any[]; lastDate: string; categories: Set<string>; latestStatus: string }>();
      for (const r of allReports as any[]) {
        const uid = r.reported_id;
        if (!userMap.has(uid)) userMap.set(uid, { reports: [], lastDate: r.created_at, categories: new Set(), latestStatus: r.status || 'pending' });
        const entry = userMap.get(uid)!;
        entry.reports.push(r);
        entry.categories.add(extractCategory(r.reason || ''));
        if (r.created_at > entry.lastDate) { entry.lastDate = r.created_at; entry.latestStatus = r.status || 'pending'; }
      }

      // Load profiles
      const userIds = [...userMap.keys()];
      const { data: profiles } = await supabase.from('profiles')
        .select('id, full_name, username, avatar_url, is_banned').in('id', userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const users: ReportedUser[] = [];
      for (const [uid, data] of userMap) {
        const prof = profileMap.get(uid);
        users.push({
          userId: uid,
          fullName: prof?.full_name || 'Desconocido',
          username: prof?.username || null,
          avatarUrl: prof?.avatar_url || null,
          reportCount: data.reports.length,
          lastReportedAt: data.lastDate,
          categories: [...data.categories],
          isBanned: !!(prof as any)?.is_banned,
          latestStatus: data.latestStatus,
        });
      }

      users.sort((a, b) => b.reportCount - a.reportCount);
      setReportedUsers(users);
      setStats({
        totalReported: users.length,
        totalReports: (allReports as any[]).length,
        banned: users.filter(u => u.isBanned).length,
      });
    } catch { setReportedUsers([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  // Apply filters
  useEffect(() => {
    let result = [...reportedUsers];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.fullName.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      result = result.filter(u => u.categories.includes(categoryFilter));
    }
    result = result.filter(u => u.reportCount >= minReports);
    if (sortBy === 'recent') result.sort((a, b) => new Date(b.lastReportedAt).getTime() - new Date(a.lastReportedAt).getTime());
    else result.sort((a, b) => b.reportCount - a.reportCount);
    setFiltered(result);
  }, [reportedUsers, searchQuery, categoryFilter, sortBy, minReports]);

  const loadUserReports = async (userId: string) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    const { data } = await supabase.from('reported_users' as any)
      .select('*').eq('reported_id', userId).order('created_at', { ascending: false });
    // Load reporter profiles
    const reporterIds = [...new Set((data || []).map((r: any) => r.reporter_id))];
    const { data: profs } = await supabase.from('profiles').select('id, full_name, username').in('id', reporterIds);
    const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
    setUserReports((data || []).map((r: any) => ({ ...r, reporter_name: profMap.get(r.reporter_id)?.full_name || 'Anonimo' })));
  };

  if (!user) return <Navigate to="/auth" replace />;

  const allCategories = [...new Set(reportedUsers.flatMap(u => u.categories))];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate('/mensajes')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
          <ArrowLeft size={20} />
        </button>
        <Shield size={22} style={{ color: '#dc2626' }} />
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Lista Negra de la Comunidad</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Usuarios reportados por la comunidad</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Usuarios Reportados', value: stats.totalReported, icon: <User size={14} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
          { label: 'Reportes Totales', value: stats.totalReports, icon: <AlertTriangle size={14} />, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          { label: 'Baneados', value: stats.banned, icon: <Ban size={14} />, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
        ].map(s => (
          <div key={s.label} style={{ flex: '1 1 120px', padding: '14px 16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: s.color, marginBottom: '4px' }}>{s.icon} <span style={{ fontSize: '11px', fontWeight: 600 }}>{s.label}</span></div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div style={{ padding: '0 24px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar por nombre o @usuario..."
            style={{ width: '100%', padding: '10px 14px 10px 36px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '13px', cursor: 'pointer' }}>
          <option value="all">Todas las categorias</option>
          {allCategories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'reports' | 'recent')}
          style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '13px', cursor: 'pointer' }}>
          <option value="reports">Mas reportes</option>
          <option value="recent">Mas recientes</option>
        </select>
        <select value={minReports} onChange={e => setMinReports(Number(e.target.value))}
          style={{ padding: '10px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '13px', cursor: 'pointer' }}>
          <option value={1}>1+ reportes</option>
          <option value={2}>2+ reportes</option>
          <option value={3}>3+ reportes</option>
          <option value={5}>5+ reportes</option>
        </select>
      </div>

      {/* Results */}
      <div style={{ padding: '0 24px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Cargando lista negra...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <Shield size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: '15px', fontWeight: 600 }}>No se encontraron usuarios reportados</p>
            <p style={{ fontSize: '13px' }}>{searchQuery ? 'Intenta con otra busqueda' : 'La comunidad esta limpia'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>{filtered.length} usuario(s) encontrado(s)</div>
            {filtered.map(u => (
              <div key={u.userId} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div onClick={() => loadUserReports(u.userId)}
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f1f5f9', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: u.isBanned ? '2px solid #dc2626' : '2px solid #e2e8f0' }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} style={{ color: '#94a3b8' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{u.fullName}</span>
                      {u.username && <span style={{ fontSize: '12px', color: '#94a3b8' }}>@{u.username}</span>}
                      {u.isBanned && <span style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>BANEADO</span>}
                      {u.reportCount >= 3 && !u.isBanned && <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>ALTO RIESGO</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{u.reportCount} reporte(s)</span>
                      {u.categories.slice(0, 3).map(c => (
                        <span key={c} style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600 }}>{CATEGORY_LABELS[c] || c}</span>
                      ))}
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(u.lastReportedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                  <ChevronDown size={18} style={{ color: '#94a3b8', transform: expandedUser === u.userId ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </div>

                {expandedUser === u.userId && (
                  <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', padding: '12px 0 8px' }}>Historial de reportes:</div>
                    {userReports.map((r: any, i: number) => {
                      const statusColors: Record<string, { color: string; bg: string }> = {
                        pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                        reviewed: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                        action_taken: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
                        dismissed: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
                      };
                      const sc = statusColors[r.status || 'pending'] || statusColors.pending;
                      const cat = extractCategory(r.reason || '');
                      return (
                        <div key={r.id || i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '6px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#0f172a', fontWeight: 600 }}>Reportado por: {r.reporter_name}</span>
                            <span style={{ background: sc.bg, color: sc.color, padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>{r.status || 'pending'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', color: '#94a3b8' }}>
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>{CATEGORY_LABELS[cat] || cat}</span>
                            <span>{r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                          </div>
                          {r.details && (() => { try { const d = JSON.parse(r.details); return d.severity ? <span style={{ marginTop: '4px', display: 'inline-block', background: 'rgba(220,38,38,0.08)', color: '#dc2626', padding: '1px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>Severidad: {d.severity.toUpperCase()}</span> : null; } catch { return null; } })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}