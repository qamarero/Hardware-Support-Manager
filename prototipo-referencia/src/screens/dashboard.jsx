// ═══════════════════════════════════════════════════════════════
// Dashboard — 3 variants (clásico / bento / focus)
// ═══════════════════════════════════════════════════════════════
const { useState: _useState, useMemo: _useMemo } = React;

function Dashboard({ state, variant, onNav, onOpenIncident }) {
  const { incidents, rmas } = state;
  const { STATUS_LABEL, STATUS_BADGE } = window.HSM_DATA;

  // ── derived ──
  const stats = _useMemo(() => {
    const open = incidents.filter(i => !['resuelta', 'cerrada'].includes(i.status));
    const waiting = incidents.filter(i => i.status === 'esperando_pieza');
    const resolved7d = incidents.filter(i => {
      if (!['resuelta', 'cerrada'].includes(i.status)) return false;
      return Date.now() - new Date(i.updatedAt).getTime() < 7 * 86400000;
    });
    const overdue = open.filter(i => window.HSM_UTIL.slaProgress(i).level === 'bad');
    const activeRmas = rmas.filter(r => r.status !== 'cerrado');
    return { openCount: open.length, waiting: waiting.length, resolved7d: resolved7d.length,
             overdue: overdue.length, activeRmas: activeRmas.length, open };
  }, [incidents, rmas]);

  // Bars (last 7 days)
  const last7 = _useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const created = incidents.filter(inc => {
        const t = new Date(inc.openedAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      const closed = incidents.filter(inc => {
        if (!['resuelta','cerrada'].includes(inc.status)) return false;
        const t = new Date(inc.updatedAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      days.push({ label: ['D','L','M','X','J','V','S'][d.getDay()], created, closed });
    }
    return days;
  }, [incidents]);
  const maxBar = Math.max(1, ...last7.map(d => Math.max(d.created, d.closed)));

  // Status breakdown
  const byStatus = _useMemo(() => {
    const counts = {};
    window.HSM_DATA.INCIDENT_STATUSES.forEach(s => counts[s] = 0);
    incidents.forEach(i => { counts[i.status] = (counts[i.status]||0) + 1; });
    return counts;
  }, [incidents]);

  // Top devices with most incidents
  const deviceIncidents = _useMemo(() => {
    const map = {};
    incidents.forEach(i => { map[i.deviceId] = (map[i.deviceId] || 0) + 1; });
    return Object.entries(map)
      .map(([id, count]) => ({ device: state.devices.find(d => d.id === id), count }))
      .filter(x => x.device)
      .sort((a,b) => b.count - a.count)
      .slice(0, 5);
  }, [incidents, state.devices]);

  if (variant === 'bento') return <DashboardBento {...{state, stats, last7, maxBar, byStatus, deviceIncidents, onNav, onOpenIncident}} />;
  if (variant === 'focus') return <DashboardFocus {...{state, stats, last7, maxBar, byStatus, deviceIncidents, onNav, onOpenIncident}} />;
  return <DashboardClassic {...{state, stats, last7, maxBar, byStatus, deviceIncidents, onNav, onOpenIncident}} />;
}

// ── Recently activity list ────────────────────────────────────
function RecentList({ incidents, onOpen, limit = 6 }) {
  const sorted = [...incidents]
    .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, limit);
  return (
    <div className="stack" style={{gap: 0}}>
      {sorted.map((i, idx) => (
        <div key={i.id} onClick={() => onOpen(i.id)}
             style={{
               display: 'flex', alignItems: 'center', gap: 12,
               padding: '12px 0',
               borderBottom: idx < sorted.length-1 ? '1px solid var(--border-light)' : 'none',
               cursor: 'pointer',
             }}>
          <PriorityPill priority={i.priority} />
          <div style={{flex:1, minWidth:0}}>
            <div className="fw-600" style={{fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{i.title}</div>
            <div className="text-xs muted mono">{i.id} · {window.HSM_UTIL.formatDate(i.updatedAt, {relative:true})}</div>
          </div>
          <StatusBadge status={i.status} />
        </div>
      ))}
    </div>
  );
}

// ── Bar chart ─────────────────────────────────────────────────
function BarChart({ data, maxBar }) {
  return (
    <div>
      <div style={{display:'flex', alignItems:'flex-end', gap:8, height:140}}>
        {data.map((d, i) => (
          <div key={i} style={{flex:1, display:'flex', flexDirection:'column', gap:2, height:'100%', justifyContent:'flex-end'}}>
            <div style={{
              height: `${(d.closed / maxBar) * 100}%`,
              background: 'var(--green-500)',
              borderRadius: '4px 4px 0 0',
              minHeight: d.closed > 0 ? 4 : 0,
            }} title={`${d.closed} cerradas`} />
            <div style={{
              height: `${(d.created / maxBar) * 100}%`,
              background: 'var(--primary)',
              borderRadius: '4px 4px 0 0',
              minHeight: d.created > 0 ? 4 : 0,
            }} title={`${d.created} abiertas`} />
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:8, marginTop:8}}>
        {data.map((d, i) => (
          <div key={i} style={{flex:1, textAlign:'center', fontSize:10, fontFamily:'var(--font-mono)', color:'var(--fg-tertiary)'}}>{d.label}</div>
        ))}
      </div>
      <div style={{display:'flex', gap:16, marginTop:16, fontSize:11}}>
        <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:10, height:10, borderRadius:2, background:'var(--primary)'}}/>Creadas</span>
        <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:10, height:10, borderRadius:2, background:'var(--green-500)'}}/>Resueltas</span>
      </div>
    </div>
  );
}

// ── Status donut (svg) ────────────────────────────────────────
function StatusDonut({ counts }) {
  const total = Object.values(counts).reduce((a,b)=>a+b, 0) || 1;
  const colors = {
    abierta: 'var(--red-500)',
    en_curso: 'var(--amber-500)',
    esperando_pieza: 'var(--purple-500)',
    resuelta: 'var(--green-500)',
    cerrada: 'var(--gray-400)',
  };
  let acc = 0;
  const r = 60;
  const c = 2 * Math.PI * r;
  const arcs = Object.entries(counts).map(([k,v]) => {
    const frac = v / total;
    const dashArray = `${frac * c} ${c}`;
    const offset = -acc * c;
    acc += frac;
    return { k, v, color: colors[k], dashArray, offset };
  });
  return (
    <div style={{display:'flex', alignItems:'center', gap:24}}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{flexShrink:0}}>
        <circle cx="70" cy="70" r="60" fill="none" stroke="var(--gray-100)" strokeWidth="16" />
        {arcs.map((a) => (
          <circle key={a.k} cx="70" cy="70" r="60" fill="none"
                  stroke={a.color} strokeWidth="16"
                  strokeDasharray={a.dashArray}
                  strokeDashoffset={a.offset}
                  transform="rotate(-90 70 70)"
                  style={{transition:'stroke-dasharray 0.4s'}} />
        ))}
        <text x="70" y="68" textAnchor="middle" fontWeight="700" fontSize="28" fill="var(--gray-900)">{total}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="11" fill="var(--gray-600)" style={{fontFamily:'var(--font-mono)', textTransform:'uppercase'}}>incidencias</text>
      </svg>
      <div style={{flex:1, display:'flex', flexDirection:'column', gap:6}}>
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
            <span style={{width:10, height:10, borderRadius:50, background:colors[k]}}/>
            <span style={{flex:1}}>{window.HSM_DATA.STATUS_LABEL[k]}</span>
            <span className="mono fw-700">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── VARIANT A: classic dashboard ──────────────────────────────
function DashboardClassic({ state, stats, last7, maxBar, byStatus, deviceIncidents, onNav, onOpenIncident }) {
  return (
    <div className="stack">
      {/* Hero */}
      <div className="hero">
        <div style={{position:'relative', zIndex:1}}>
          <div className="ds-overline" style={{color:'var(--accent-coral)', marginBottom:8, fontFamily:'var(--font-mono)', fontSize:11}}>HARDWARE · LUN 27 MAY · 2026</div>
          <h2>Buenos días, Marta</h2>
          <p>Hoy hay {stats.openCount} incidencias abiertas{stats.overdue > 0 ? `, ${stats.overdue} fuera de SLA` : ''}. {stats.activeRmas} RMA activos en curso.</p>
          <div style={{display:'flex', gap:8, marginTop:16}}>
            <button className="btn btn--primary" onClick={() => onNav('incidents-new')}>
              <Icon name="plus" size={14}/> Nueva incidencia
            </button>
            <button className="btn btn--outline" style={{background:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)'}}
                    onClick={() => onNav('kanban')}>
              Tablero Kanban <Icon name="arrowRight" size={14}/>
            </button>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi__label">Abiertas</div>
          <div className="kpi__value">{stats.openCount}<sup>incidencias</sup></div>
          <div className={`kpi__delta ${stats.openCount > 8 ? 'kpi__delta--up' : 'kpi__delta--flat'}`}>
            <Icon name="alert" size={12}/> {stats.overdue} fuera de SLA
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Esperando pieza</div>
          <div className="kpi__value">{stats.waiting}<sup>tickets</sup></div>
          <div className="kpi__delta kpi__delta--flat">
            <Icon name="package" size={12}/> {stats.activeRmas} RMA en curso
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Resueltas (7d)</div>
          <div className="kpi__value">{stats.resolved7d}<sup>tickets</sup></div>
          <div className="kpi__delta kpi__delta--up">
            <Icon name="check" size={12}/> +18% vs semana pasada
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Tiempo medio resolución</div>
          <div className="kpi__value">2,4<sup>días</sup></div>
          <div className="kpi__delta kpi__delta--up">
            <Icon name="check" size={12}/> -0,3d vs mes pasado
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="row row--2">
        <Card title="Actividad de la semana" subtitle="Incidencias creadas vs resueltas">
          <BarChart data={last7} maxBar={maxBar} />
        </Card>
        <Card title="Estado de tickets" subtitle="Distribución actual">
          <StatusDonut counts={byStatus} />
        </Card>
      </div>

      {/* Recent + top devices */}
      <div className="row row--2-1">
        <Card title="Actividad reciente"
              action={<button className="btn btn--ghost btn--sm" onClick={() => onNav('incidents')}>Ver todas <Icon name="arrowRight" size={12}/></button>}>
          <RecentList incidents={state.incidents} onOpen={onOpenIncident} />
        </Card>
        <Card title="Equipos problemáticos" subtitle="Más incidencias últimos 30d">
          <div className="stack" style={{gap:12}}>
            {deviceIncidents.map(({device, count}) => (
              <div key={device.id} style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{
                  width:32, height:32, background:'var(--gray-100)',
                  borderRadius:8, display:'grid', placeItems:'center', flexShrink:0,
                  color:'var(--gray-700)',
                }}>
                  <DeviceIcon type={device.type} size={16} />
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="fw-600 text-sm" style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{device.model}</div>
                  <div className="text-xs muted mono">{device.serial}</div>
                </div>
                <span className="badge badge--orange">{count} tickets</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── VARIANT B: bento dashboard ────────────────────────────────
function DashboardBento({ state, stats, last7, maxBar, byStatus, deviceIncidents, onNav, onOpenIncident }) {
  return (
    <div className="bento">
      <div className="brand span-2 row-2" style={{display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
        <div>
          <div className="kpi__label" style={{color:'rgba(255,255,255,0.75)'}}>Abiertas hoy</div>
          <div className="kpi__value" style={{color:'#fff', fontSize:64}}>{stats.openCount}</div>
        </div>
        <div>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
            <Icon name="alert" size={14}/>
            <span style={{fontSize:13, fontWeight:600}}>{stats.overdue} fuera de SLA</span>
          </div>
          <button className="btn btn--sm" style={{background:'#fff', color:'var(--primary)'}}
                  onClick={() => onNav('incidents')}>Ver incidencias <Icon name="arrowRight" size={12}/></button>
        </div>
      </div>

      <div className="span-2">
        <div className="kpi__label">Esperando pieza</div>
        <div className="kpi__value">{stats.waiting}</div>
      </div>
      <div className="span-2">
        <div className="kpi__label">Resueltas (7d)</div>
        <div className="kpi__value">{stats.resolved7d}</div>
      </div>

      <div className="span-2">
        <div className="kpi__label">Tiempo medio</div>
        <div className="kpi__value">2,4d</div>
      </div>
      <div className="accent span-2" style={{display:'flex', flexDirection:'column', justifyContent:'center'}}>
        <div className="kpi__label">RMA activos</div>
        <div className="kpi__value">{stats.activeRmas}</div>
        <button onClick={() => onNav('rma')} style={{marginTop:8, alignSelf:'flex-start', background:'transparent', color:'#fff', border:'0', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:4}}>
          Ver RMA <Icon name="arrowRight" size={12}/>
        </button>
      </div>

      <div className="span-4 row-3" style={{display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
          <div>
            <h3 style={{margin:0, fontSize:15, fontWeight:700}}>Actividad de la semana</h3>
            <p style={{margin:'2px 0 0', fontSize:12, color:'var(--fg-secondary)'}}>Creadas vs resueltas · últimos 7 días</p>
          </div>
        </div>
        <div style={{flex:1}}>
          <BarChart data={last7} maxBar={maxBar} />
        </div>
      </div>

      <div className="span-2 row-2">
        <h3 style={{margin:'0 0 16px', fontSize:14, fontWeight:700}}>Estado</h3>
        <StatusDonut counts={byStatus} />
      </div>

      <div className="span-6 row-2" style={{padding:0}}>
        <div className="card__header" style={{padding:'16px 24px'}}>
          <div>
            <h3>Actividad reciente</h3>
            <p>Últimos movimientos en tickets</p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => onNav('incidents')}>Ver todas <Icon name="arrowRight" size={12}/></button>
        </div>
        <div style={{padding:'8px 24px 24px'}}>
          <RecentList incidents={state.incidents} onOpen={onOpenIncident} limit={4} />
        </div>
      </div>
    </div>
  );
}

// ── VARIANT C: focus / single-column ──────────────────────────
function DashboardFocus({ state, stats, last7, maxBar, byStatus, deviceIncidents, onNav, onOpenIncident }) {
  // single big hero number + critical queue
  const critical = state.incidents
    .filter(i => !['resuelta','cerrada'].includes(i.status))
    .sort((a,b) => {
      const pa = window.HSM_UTIL.slaProgress(a).pct;
      const pb = window.HSM_UTIL.slaProgress(b).pct;
      return pb - pa;
    })
    .slice(0, 6);

  return (
    <div className="stack">
      <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16}}>
        <div className="card" style={{padding:32, background:'var(--gray-900)', color:'#fff', borderColor:'var(--gray-900)'}}>
          <div className="kpi__label" style={{color:'var(--gray-400)'}}>QUEUE · ahora mismo</div>
          <div style={{display:'flex', alignItems:'baseline', gap:16, marginTop:8}}>
            <div style={{fontSize:96, fontWeight:700, lineHeight:1, letterSpacing:'-0.04em'}}>{stats.openCount}</div>
            <div style={{color:'var(--gray-300)', fontSize:18}}>tickets que requieren atención</div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24, marginTop:32}}>
            <div>
              <div style={{color:'var(--red-500)', fontSize:32, fontWeight:700, fontFamily:'var(--font-mono)'}}>{stats.overdue}</div>
              <div style={{color:'var(--gray-400)', fontSize:12, marginTop:2}}>Fuera de SLA</div>
            </div>
            <div>
              <div style={{color:'var(--amber-500)', fontSize:32, fontWeight:700, fontFamily:'var(--font-mono)'}}>{stats.waiting}</div>
              <div style={{color:'var(--gray-400)', fontSize:12, marginTop:2}}>Esperando pieza</div>
            </div>
            <div>
              <div style={{color:'var(--green-500)', fontSize:32, fontWeight:700, fontFamily:'var(--font-mono)'}}>{stats.resolved7d}</div>
              <div style={{color:'var(--gray-400)', fontSize:12, marginTop:2}}>Resueltas 7d</div>
            </div>
          </div>
        </div>
        <Card title="Tu agenda" subtitle="Tickets asignados a Marta Ferrer">
          <div className="stack" style={{gap:0}}>
            {state.incidents
              .filter(i => i.assigneeId === 'u1' && !['cerrada'].includes(i.status))
              .slice(0, 4)
              .map((i, idx, arr) => (
                <div key={i.id} onClick={() => onOpenIncident(i.id)}
                     style={{display:'flex', alignItems:'center', gap:10, padding:'10px 0', cursor:'pointer',
                             borderBottom: idx < arr.length-1 ? '1px solid var(--border-light)' : 'none'}}>
                  <PriorityPill priority={i.priority} />
                  <div style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13, fontWeight:500}}>
                    {i.title}
                  </div>
                  <SlaBar incident={i} />
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Card title="Cola priorizada por SLA" subtitle="Los más urgentes primero"
            action={<button className="btn btn--ghost btn--sm" onClick={() => onNav('incidents')}>Ver listado completo <Icon name="arrowRight" size={12}/></button>}>
        <div className="table-wrap" style={{border:'none', borderRadius:0}}>
          <table className="table table--dense">
            <thead>
              <tr>
                <th>ID</th><th>Incidencia</th><th>Equipo</th><th>Asignado</th><th>SLA</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {critical.map(i => {
                const device = state.devices.find(d => d.id === i.deviceId);
                const tech = state.technicians.find(t => t.id === i.assigneeId);
                return (
                  <tr key={i.id} onClick={() => onOpenIncident(i.id)}>
                    <td className="id-cell">{i.id}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <PriorityPill priority={i.priority} />
                        <span className="fw-600">{i.title}</span>
                      </div>
                    </td>
                    <td className="text-sm">
                      <div className="flex items-center gap-2">
                        <DeviceIcon type={device?.type}/> {device?.model || '—'}
                      </div>
                    </td>
                    <td>{tech && <div className="flex items-center gap-2"><Avatar name={tech.name} initials={tech.initials} size="sm"/>{tech.name}</div>}</td>
                    <td><SlaBar incident={i} /></td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { Dashboard });
