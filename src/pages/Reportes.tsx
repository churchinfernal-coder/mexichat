import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Shield, Search, AlertTriangle, User, ChevronDown, ArrowLeft, Ban } from 'lucide-react';

interface ReportedUser {
  userId: string; fullName: string; username: string | null; avatarUrl: string | null;
  reportCount: number; lastReportedAt: string; categories: string[]; isBanned: boolean;
}

const CAT: Record<string, string> = {
  spam: 'Spam', harassment: 'Acoso', fake: 'Perfil falso', underage: 'Menor',
  scam: 'Estafa', csam: 'CSAM', extortion: 'Extorsion', terrorism: 'Terrorismo',
  fraud: 'Fraude', threats: 'Amenazas', hate_speech: 'Odio', drug_sales: 'Drogas',
  weapons: 'Armas', doxxing: 'Doxxing', identity_theft: 'Suplantacion',
  sexual_harassment: 'Acoso sexual', self_harm: 'Autolesion',
  human_trafficking: 'Trata', revenge_porn: 'Porno NC', inappropriate: 'Inapropiado',
  fake_profile: 'Perfil falso', other: 'Otro',
};

function exCat(r: string): string { const m = r.match(/^\[([^\]]+)\]/); return m ? m[1] : r; }

export default function Reportes() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [users, setUsers] = useState<ReportedUser[]>([]);
  const [filtered, setFiltered] = useState<ReportedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('all');
  const [sortBy, setSortBy] = useState<'reports' | 'recent'>('reports');
  const [minR, setMinR] = useState(1);
  const [exp, setExp] = useState<string | null>(null);
  const [det, setDet] = useState<any[]>([]);
  const [stats, setStats] = useState({ u: 0, r: 0, b: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: all } = await (supabase.from('reported_users' as any).select('*') as any).order('created_at', { ascending: false }).limit(1000);
      if (!all || all.length === 0) { setUsers([]); setFiltered([]); setLoading(false); return; }
      const map = new Map<string, { reps: any[]; last: string; cats: Set<string> }>();
      for (const r of all) {
        if (!map.has(r.reported_id)) map.set(r.reported_id, { reps: [], last: r.created_at, cats: new Set() });
        const e = map.get(r.reported_id)!;
        e.reps.push(r); e.cats.add(exCat(r.reason || ''));
        if (r.created_at > e.last) e.last = r.created_at;
      }
      const ids = [...map.keys()];
      const { data: profs } = await supabase.from('profiles').select('id, full_name, username, avatar_url, is_banned').in('id', ids);
      const pm = new Map((profs || []).map((p: any) => [p.id, p]));
      const res: ReportedUser[] = [];
      for (const [uid, d] of map) {
        const p = pm.get(uid) as any;
        res.push({ userId: uid, fullName: p?.full_name || 'Desconocido', username: p?.username || null, avatarUrl: p?.avatar_url || null, reportCount: d.reps.length, lastReportedAt: d.last, categories: [...d.cats], isBanned: !!p?.is_banned });
      }
      res.sort((a, b) => b.reportCount - a.reportCount);
      setUsers(res);
      setStats({ u: res.length, r: all.length, b: res.filter(x => x.isBanned).length });
    } catch { setUsers([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let r = [...users];
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(u => u.fullName.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)); }
    if (catF !== 'all') r = r.filter(u => u.categories.includes(catF));
    r = r.filter(u => u.reportCount >= minR);
    if (sortBy === 'recent') r.sort((a, b) => new Date(b.lastReportedAt).getTime() - new Date(a.lastReportedAt).getTime());
    else r.sort((a, b) => b.reportCount - a.reportCount);
    setFiltered(r);
  }, [users, search, catF, sortBy, minR]);

  const expand = async (uid: string) => {
    if (exp === uid) { setExp(null); return; }
    setExp(uid);
    const { data } = await (supabase.from('reported_users' as any).select('*') as any).eq('reported_id', uid).order('created_at', { ascending: false });
    const rids = [...new Set((data || []).map((r: any) => r.reporter_id))] as string[];
    const { data: rp } = await supabase.from('profiles').select('id, full_name').in('id', rids);
    const rpm = new Map((rp || []).map((p: any) => [p.id, p]));
    setDet((data || []).map((r: any) => ({ ...r, rn: (rpm.get(r.reporter_id) as any)?.full_name || 'Anonimo' })));
  };

  useEffect(() => {
    const ch = supabase.channel('reportes-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reported_users' }, () => { load(); }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  if (!user) return <Navigate to="/auth" replace />;
  const allCats = [...new Set(users.flatMap(u => u.categories))];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => nav('/mensajes')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}><ArrowLeft size={20} /></button>
        <Shield size={22} style={{ color: '#dc2626' }} />
        <div><h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Lista Negra</h1><p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Usuarios reportados por la comunidad</p></div>
      </div>
      <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', flexWrap: 'wrap' }}>
        {[{ l: 'Reportados', v: stats.u, c: '#f59e0b' }, { l: 'Reportes', v: stats.r, c: '#ef4444' }, { l: 'Baneados', v: stats.b, c: '#dc2626' }].map(s => (
          <div key={s.l} style={{ flex: '1 1 100px', padding: '14px 16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: s.c, marginBottom: '4px' }}>{s.l}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 24px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ width: '100%', padding: '10px 14px 10px 36px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <select value={catF} onChange={e => setCatF(e.target.value)} style={{ padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
          <option value="all">Todas</option>{allCats.map(c => <option key={c} value={c}>{CAT[c] || c}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
          <option value="reports">Mas reportes</option><option value="recent">Recientes</option>
        </select>
        <select value={minR} onChange={e => setMinR(Number(e.target.value))} style={{ padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
          <option value={1}>1+</option><option value={2}>2+</option><option value={3}>3+</option><option value={5}>5+</option>
        </select>
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Cargando...</div> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}><Shield size={48} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} /><p>{search ? 'Sin resultados' : 'Comunidad limpia'}</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{filtered.length} usuario(s)</div>
            {filtered.map(u => (
              <div key={u.userId} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div onClick={() => expand(u.userId)} style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f1f5f9', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: u.isBanned ? '2px solid #dc2626' : '2px solid #e2e8f0' }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} style={{ color: '#94a3b8' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{u.fullName}</span>
                      {u.username && <span style={{ fontSize: '12px', color: '#94a3b8' }}>{'@' + u.username}</span>}
                      {u.isBanned && <span style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>BANEADO</span>}
                      {u.reportCount >= 3 && !u.isBanned && <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '1px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>ALTO RIESGO</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{u.reportCount} reporte(s)</span>
                      {u.categories.slice(0, 3).map(c => <span key={c} style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600 }}>{CAT[c] || c}</span>)}
                    </div>
                  </div>
                  <ChevronDown size={18} style={{ color: '#94a3b8', transform: exp === u.userId ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </div>
                {exp === u.userId && (
                  <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', padding: '12px 0 8px' }}>Historial:</div>
                    {det.map((r: any, i: number) => {
                      const sc: Record<string, { c: string; bg: string }> = { pending: { c: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }, reviewed: { c: '#3b82f6', bg: 'rgba(59,130,246,0.1)' }, action_taken: { c: '#22c55e', bg: 'rgba(34,197,94,0.1)' }, dismissed: { c: '#94a3b8', bg: 'rgba(148,163,184,0.1)' } };
                      const s = sc[r.status || 'pending'] || sc.pending;
                      return (<div key={r.id || i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '6px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: '#0f172a', fontWeight: 600 }}>Por: {r.rn}</span><span style={{ background: s.bg, color: s.c, padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>{r.status || 'pending'}</span></div>
                        <div style={{ color: '#94a3b8', display: 'flex', gap: '8px' }}><span style={{ color: '#ef4444', fontWeight: 600 }}>{CAT[exCat(r.reason || '')] || exCat(r.reason || '')}</span><span>{r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span></div>
                      </div>);
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}