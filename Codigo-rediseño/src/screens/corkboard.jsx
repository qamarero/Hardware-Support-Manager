// ═══════════════════════════════════════════════════════════════
// Corkboard — vista rápida de incidencias como post-its en un corcho
// ═══════════════════════════════════════════════════════════════
const { useState: ckState, useMemo: ckMemo } = React;

// Post-it palette by priority (warm sticky-note colors that fit Qamarero)
const POSTIT_COLORS = {
  critica: { bg: '#ffd4cc', edge: '#ffb8aa', ink: '#8a1c00', tape: 'rgba(244,83,43,0.25)' },
  alta:    { bg: '#ffe7b3', edge: '#ffd98a', ink: '#7a4e00', tape: 'rgba(255,170,0,0.22)' },
  media:   { bg: '#fff7 a', edge: '#fff04d', ink: '#6b5e00', tape: 'rgba(180,160,0,0.18)' },
  baja:    { bg: '#d7f0d2', edge: '#bce4b4', ink: '#1f5a17', tape: 'rgba(2,153,93,0.18)' },
};
// Fix media yellow (no spaces allowed in hex)
POSTIT_COLORS.media.bg = '#fff79a';

// Deterministic small rotation per id so it's stable across renders
function rotFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return ((h % 700) / 100) - 3.5; // -3.5deg .. +3.5deg
}

function CorkboardScreen({ state, setState, onOpenIncident, onCreate }) {
  const [groupBy, setGroupBy] = ckState('status'); // status | priority | assignee
  const [hideClosed, setHideClosed] = ckState(true);
  const [filterAssignee, setFilterAssignee] = ckState('all');

  const visible = ckMemo(() => {
    let arr = state.incidents.slice();
    if (hideClosed) arr = arr.filter(i => !['cerrada'].includes(i.status));
    if (filterAssignee !== 'all') arr = arr.filter(i => i.assigneeId === filterAssignee);
    return arr;
  }, [state.incidents, hideClosed, filterAssignee]);

  const zones = ckMemo(() => {
    if (groupBy === 'priority') {
      return ['critica','alta','media','baja'].map(p => ({
        key: p, label: window.HSM_DATA.PRIORITY_LABEL[p],
        items: visible.filter(i => i.priority === p),
      })).filter(z => z.items.length);
    }
    if (groupBy === 'assignee') {
      return state.technicians.map(t => ({
        key: t.id, label: t.name,
        items: visible.filter(i => i.assigneeId === t.id),
      })).filter(z => z.items.length);
    }
    // status
    return window.HSM_DATA.INCIDENT_STATUSES
      .filter(s => !(hideClosed && s === 'cerrada'))
      .map(s => ({
        key: s, label: window.HSM_DATA.STATUS_LABEL[s],
        paused: window.HSM_DATA.PAUSED_STATUSES.has(s),
        items: visible.filter(i => i.status === s),
      })).filter(z => z.items.length);
  }, [visible, groupBy, state.technicians, hideClosed]);

  return (
    <div className="stack">
      {/* Controls */}
      <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
        <div className="seg">
          <button className={groupBy==='status'?'is-active':''} onClick={() => setGroupBy('status')}>Por estado</button>
          <button className={groupBy==='priority'?'is-active':''} onClick={() => setGroupBy('priority')}>Por prioridad</button>
          <button className={groupBy==='assignee'?'is-active':''} onClick={() => setGroupBy('assignee')}>Por técnico</button>
        </div>
        <select className="select" style={{width:'auto'}} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="all">Todos los técnicos</option>
          {state.technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className={`chip ${hideClosed ? 'is-active' : ''}`} onClick={() => setHideClosed(!hideClosed)}>
          {hideClosed ? 'Ocultando cerradas' : 'Mostrando cerradas'}
        </button>
        <div style={{flex:1}}/>
        <div className="muted text-xs">Vista rápida del día · click en una nota para abrirla</div>
        <button className="btn btn--primary btn--sm" onClick={onCreate}><Icon name="plus" size={14}/> Nueva</button>
      </div>

      {/* The cork board */}
      <div className="cork">
        {zones.map(zone => (
          <div key={zone.key} className="cork__zone">
            <div className="cork__zone-label">
              {groupBy === 'priority' && <span className={`priority priority--${zone.key}`}><span className="priority__dot"/></span>}
              {zone.label}
              <span className="cork__zone-count">{zone.items.length}</span>
              {zone.paused && <Icon name="clock" size={11} color="rgba(255,255,255,0.7)" />}
            </div>
            <div className="cork__notes">
              {zone.items.map(inc => (
                <PostIt key={inc.id} incident={inc} state={state} onOpen={() => onOpenIncident(inc.id)} />
              ))}
            </div>
          </div>
        ))}
        {!zones.length && (
          <div style={{gridColumn:'1/-1', textAlign:'center', padding:'60px 20px', color:'rgba(255,255,255,0.85)'}}>
            <Icon name="ticket" size={28} color="rgba(255,255,255,0.7)" />
            <div className="fw-700" style={{marginTop:8, fontSize:15}}>No hay notas que mostrar</div>
            <div className="text-sm" style={{opacity:0.8}}>Ajusta los filtros o crea una incidencia.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post-it note ──────────────────────────────────────────────
function PostIt({ incident, state, onOpen }) {
  const c = POSTIT_COLORS[incident.priority] || POSTIT_COLORS.media;
  const device = state.devices.find(d => d.id === incident.deviceId);
  const tech = state.technicians.find(t => t.id === incident.assigneeId);
  const rot = rotFor(incident.id);
  const sla = window.HSM_UTIL.slaProgress(incident);
  const isClosed = ['resuelta','cerrada'].includes(incident.status);

  return (
    <button className="postit" onClick={onOpen}
            style={{
              '--rot': `${rot}deg`,
              background: `linear-gradient(160deg, ${c.bg} 0%, ${c.edge} 100%)`,
              color: c.ink,
            }}>
      {/* Pin */}
      <span className="postit__pin" aria-hidden="true" />
      {/* Tape accent for paused/overdue */}
      {sla.isPaused && <span className="postit__flag postit__flag--paused"><Icon name="clock" size={11}/> En pausa</span>}
      {!sla.isPaused && !isClosed && sla.level === 'bad' && <span className="postit__flag postit__flag--late">Fuera de SLA</span>}

      <div className="postit__id">{incident.id}</div>
      <div className="postit__title">{incident.title}</div>

      <div className="postit__meta">
        {device && (
          <span className="postit__device">
            <DeviceIcon type={device.type} size={14} /> {device.model.split(' ').slice(0,2).join(' ')}
          </span>
        )}
      </div>

      <div className="postit__foot">
        {tech ? (
          <span className="postit__tech">
            <Avatar name={tech.name} initials={tech.initials} size="sm" />
            {tech.name.split(' ')[0]}
          </span>
        ) : <span/>}
        {incident.rmaId
          ? <span className="postit__rma"><Icon name="rma" size={12}/> RMA</span>
          : <span className="postit__date">{window.HSM_UTIL.formatDate(incident.updatedAt, {relative:true})}</span>}
      </div>
    </button>
  );
}

Object.assign(window, { CorkboardScreen });
