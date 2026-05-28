// ═══════════════════════════════════════════════════════════════
// Incidents — list (3 variants) + kanban + detail drawer + form
// ═══════════════════════════════════════════════════════════════
const { useState: incState, useMemo: incMemo, useRef: incRef } = React;

function IncidentsScreen({ state, setState, variant, listVariant, onOpenIncident, onCreate, onConvertRma, prefilters }) {
  const [filterStatus, setFilterStatus] = incState(prefilters?.status || 'all');
  const [filterPriority, setFilterPriority] = incState('all');
  const [filterAssignee, setFilterAssignee] = incState('all');
  const [query, setQuery] = incState('');
  const [sortKey, setSortKey] = incState('updatedAt');

  const filtered = incMemo(() => {
    let arr = state.incidents.slice();
    if (filterStatus !== 'all') arr = arr.filter(i => i.status === filterStatus);
    if (filterPriority !== 'all') arr = arr.filter(i => i.priority === filterPriority);
    if (filterAssignee !== 'all') arr = arr.filter(i => i.assigneeId === filterAssignee);
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(i => {
        const device = state.devices.find(d => d.id === i.deviceId);
        return (
          i.id.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q) ||
          (device?.model || '').toLowerCase().includes(q) ||
          (device?.serial || '').toLowerCase().includes(q)
        );
      });
    }
    arr.sort((a, b) => {
      if (sortKey === 'updatedAt') return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (sortKey === 'priority') {
        const order = { critica: 0, alta: 1, media: 2, baja: 3 };
        return order[a.priority] - order[b.priority];
      }
      if (sortKey === 'sla') {
        return window.HSM_UTIL.slaProgress(b).pct - window.HSM_UTIL.slaProgress(a).pct;
      }
      return 0;
    });
    return arr;
  }, [state.incidents, state.devices, filterStatus, filterPriority, filterAssignee, query, sortKey]);

  const statusCounts = incMemo(() => {
    const c = { all: state.incidents.length };
    window.HSM_DATA.INCIDENT_STATUSES.forEach(s => { c[s] = state.incidents.filter(i => i.status === s).length; });
    return c;
  }, [state.incidents]);

  const onExport = () => {
    const rows = filtered.map(i => {
      const d = state.devices.find(x => x.id === i.deviceId);
      const t = state.technicians.find(x => x.id === i.assigneeId);
      return {
        ID: i.id,
        Título: i.title,
        Estado: window.HSM_DATA.STATUS_LABEL[i.status],
        Prioridad: window.HSM_DATA.PRIORITY_LABEL[i.priority],
        Equipo: d ? `${d.model} (${d.serial})` : '',
        Asignado: t?.name || '',
        Reportador: i.reporter,
        Abierta: new Date(i.openedAt).toLocaleDateString('es-ES'),
        Actualizada: new Date(i.updatedAt).toLocaleDateString('es-ES'),
        SLA_horas: i.slaHours,
        RMA: i.rmaId || '',
      };
    });
    window.HSM_UTIL.exportCsv(`incidencias_${new Date().toISOString().slice(0,10)}.csv`, rows);
    window.HSM_TOAST?.('CSV descargado');
  };

  return (
    <div className="stack">
      {/* Toolbar */}
      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        <div className="search" style={{flex:1, maxWidth:360}}>
          <Icon name="search" size={14}/>
          <input placeholder="Buscar por ID, título, modelo, serie…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select className="select" style={{width:'auto'}} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">Toda prioridad</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select className="select" style={{width:'auto'}} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="all">Todos los técnicos</option>
          {state.technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="select" style={{width:'auto'}} value={sortKey} onChange={e => setSortKey(e.target.value)}>
          <option value="updatedAt">Ord: + recientes</option>
          <option value="priority">Ord: prioridad</option>
          <option value="sla">Ord: SLA</option>
        </select>
        <div style={{flex:1}} />
        <button className="btn btn--outline btn--sm" onClick={onExport}>
          <Icon name="download" size={14}/> CSV
        </button>
        <button className="btn btn--primary btn--sm" onClick={onCreate}>
          <Icon name="plus" size={14}/> Nueva
        </button>
      </div>

      {/* Status chips */}
      <div className="filterbar">
        <button className={`chip ${filterStatus==='all' ? 'is-active' : ''}`} onClick={() => setFilterStatus('all')}>
          Todas <span className="chip__count">{statusCounts.all}</span>
        </button>
        {window.HSM_DATA.INCIDENT_STATUSES.map(s => (
          <button key={s} className={`chip ${filterStatus===s ? 'is-active' : ''}`} onClick={() => setFilterStatus(s)}>
            {window.HSM_DATA.STATUS_LABEL[s]} <span className="chip__count">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* The list */}
      {listVariant === 'cards' ? (
        <IncidentCardsList incidents={filtered} state={state} onOpenIncident={onOpenIncident} />
      ) : listVariant === 'grouped' ? (
        <IncidentGroupedList incidents={filtered} state={state} onOpenIncident={onOpenIncident} />
      ) : (
        <IncidentTable incidents={filtered} state={state} onOpenIncident={onOpenIncident} />
      )}
    </div>
  );
}

// ── List variant A: dense table ───────────────────────────────
function IncidentTable({ incidents, state, onOpenIncident }) {
  if (!incidents.length) return <EmptyState icon="ticket" title="Sin resultados" subtitle="Ajusta los filtros o crea una nueva incidencia." />;
  return (
    <div className="table-wrap">
      <table className="table table--dense">
        <thead>
          <tr>
            <th>ID</th>
            <th>Incidencia</th>
            <th>Equipo</th>
            <th>Reportador</th>
            <th>Asignado</th>
            <th>Prioridad</th>
            <th>SLA</th>
            <th>Estado</th>
            <th>Actualizada</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map(i => {
            const device = state.devices.find(d => d.id === i.deviceId);
            const tech = state.technicians.find(t => t.id === i.assigneeId);
            return (
              <tr key={i.id} onClick={() => onOpenIncident(i.id)}>
                <td className="id-cell">{i.id}</td>
                <td>
                  <div className="fw-600">{i.title}</div>
                  {i.rmaId && (
                    <div style={{marginTop:3}}>
                      <span className="badge badge--purple" style={{fontSize:10}}>
                        <Icon name="rma" size={10}/> {i.rmaId}
                      </span>
                    </div>
                  )}
                </td>
                <td>
                  {device ? (
                    <div className="flex items-center gap-2 text-sm">
                      <DeviceIcon type={device.type} size={14} />
                      <div>
                        <div style={{fontWeight:500}}>{device.model}</div>
                        <div className="mono text-xs muted">{device.serial}</div>
                      </div>
                    </div>
                  ) : '—'}
                </td>
                <td className="text-sm">{i.reporter}</td>
                <td>
                  {tech ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={tech.name} initials={tech.initials} size="sm" />
                      <span className="text-sm">{tech.name.split(' ')[0]}</span>
                    </div>
                  ) : '—'}
                </td>
                <td><PriorityPill priority={i.priority} /></td>
                <td><SlaBar incident={i} /></td>
                <td><StatusBadge status={i.status} /></td>
                <td className="text-sm muted">{window.HSM_UTIL.formatDate(i.updatedAt, { relative: true })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── List variant B: card list ─────────────────────────────────
function IncidentCardsList({ incidents, state, onOpenIncident }) {
  if (!incidents.length) return <EmptyState icon="ticket" title="Sin resultados" subtitle="Ajusta los filtros o crea una nueva incidencia." />;
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:14}}>
      {incidents.map(i => {
        const device = state.devices.find(d => d.id === i.deviceId);
        const tech = state.technicians.find(t => t.id === i.assigneeId);
        return (
          <div key={i.id} className="card" style={{padding:18, cursor:'pointer'}} onClick={() => onOpenIncident(i.id)}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
              <span className="id-cell">{i.id}</span>
              <StatusBadge status={i.status} />
            </div>
            <div style={{fontWeight:700, fontSize:14, marginBottom:6, lineHeight:1.35}}>{i.title}</div>
            <div className="text-sm muted" style={{display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight:36}}>
              {i.description}
            </div>
            <div style={{display:'flex', alignItems:'center', gap:12, marginTop:14, paddingTop:14, borderTop:'1px solid var(--border-light)'}}>
              {device && (
                <div className="flex items-center gap-2 text-xs muted">
                  <DeviceIcon type={device.type} size={14} />
                  <span style={{maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{device.model}</span>
                </div>
              )}
              <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
                <PriorityPill priority={i.priority} />
                {tech && <Avatar name={tech.name} initials={tech.initials} size="sm" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List variant C: grouped by priority ───────────────────────
function IncidentGroupedList({ incidents, state, onOpenIncident }) {
  const groups = ['critica', 'alta', 'media', 'baja'].map(p => ({
    priority: p,
    items: incidents.filter(i => i.priority === p),
  })).filter(g => g.items.length > 0);
  if (!groups.length) return <EmptyState icon="ticket" title="Sin resultados" subtitle="Ajusta los filtros o crea una nueva incidencia." />;
  return (
    <div className="stack" style={{gap:20}}>
      {groups.map(g => (
        <div key={g.priority}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8, padding:'0 4px'}}>
            <PriorityPill priority={g.priority} />
            <span className="muted text-sm">{g.items.length} incidencias</span>
          </div>
          <div className="table-wrap">
            <table className="table table--dense">
              <tbody>
                {g.items.map(i => {
                  const device = state.devices.find(d => d.id === i.deviceId);
                  const tech = state.technicians.find(t => t.id === i.assigneeId);
                  return (
                    <tr key={i.id} onClick={() => onOpenIncident(i.id)}>
                      <td style={{width:120}} className="id-cell">{i.id}</td>
                      <td><span className="fw-600">{i.title}</span></td>
                      <td className="text-sm" style={{width:240}}>
                        {device && (
                          <div className="flex items-center gap-2">
                            <DeviceIcon type={device.type} size={14}/>
                            <span>{device.model}</span>
                          </div>
                        )}
                      </td>
                      <td style={{width:120}}>{tech && <div className="flex items-center gap-2"><Avatar name={tech.name} initials={tech.initials} size="sm"/><span className="text-sm">{tech.name.split(' ')[0]}</span></div>}</td>
                      <td style={{width:140}}><SlaBar incident={i} /></td>
                      <td style={{width:120}}><StatusBadge status={i.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="card empty">
      <Icon name={icon} size={28} color="var(--gray-400)" />
      <h4>{title}</h4>
      <div className="text-sm">{subtitle}</div>
      {action && <div style={{marginTop:12}}>{action}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// KANBAN
// ═══════════════════════════════════════════════════════════════
function KanbanScreen({ state, setState, onOpenIncident, onCreate }) {
  const [dragId, setDragId] = incState(null);
  const [overCol, setOverCol] = incState(null);
  const [filterAssignee, setFilterAssignee] = incState('all');
  const cols = window.HSM_DATA.INCIDENT_STATUSES;

  const visible = filterAssignee === 'all' ? state.incidents : state.incidents.filter(i => i.assigneeId === filterAssignee);

  const onDragStart = (id) => setDragId(id);
  const onDragEnd = () => { setDragId(null); setOverCol(null); };
  const onDragOver = (e, status) => { e.preventDefault(); setOverCol(status); };
  const onDrop = (status) => {
    if (!dragId) return;
    const inc = state.incidents.find(i => i.id === dragId);
    if (!inc || inc.status === status) { onDragEnd(); return; }
    const byName = state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema';
    const updated = state.incidents.map(i =>
      i.id === dragId ? window.HSM_UTIL.transitionIncident(i, status, byName) : i
    );
    setState({ ...state, incidents: updated });
    const pausedNote = window.HSM_DATA.PAUSED_STATUSES.has(status) ? ' · SLA pausado' : '';
    window.HSM_TOAST?.(`${dragId} → ${window.HSM_DATA.STATUS_LABEL[status]}${pausedNote}`);
    onDragEnd();
  };

  return (
    <div className="stack">
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <select className="select" style={{width:'auto'}} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="all">Todos los técnicos</option>
          {state.technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="muted text-sm">Arrastra las tarjetas para cambiar de estado</div>
        <div style={{flex:1}}/>
        <button className="btn btn--primary btn--sm" onClick={onCreate}><Icon name="plus" size={14}/> Nueva</button>
      </div>

      <div className="kanban">
        {cols.map(col => {
          const items = visible.filter(i => i.status === col);
          const isPaused = window.HSM_DATA.PAUSED_STATUSES.has(col);
          const dotColor = col==='abierta' ? 'red'
            : col==='en_curso' ? 'amber'
            : col==='esperando_pieza' ? 'purple'
            : col==='esperando_proveedor' || col==='esperando_cliente' ? 'blue'
            : col==='resuelta' ? 'green' : 'gray';
          return (
            <div key={col}
                 className={`kcol ${overCol === col ? 'is-over' : ''} ${isPaused ? 'kcol--paused' : ''}`}
                 onDragOver={(e) => onDragOver(e, col)}
                 onDragLeave={() => setOverCol(null)}
                 onDrop={() => onDrop(col)}>
              <div className="kcol__header">
                <span style={{ width:8, height:8, borderRadius:50, background: `var(--${dotColor}-500)` }}/>
                {window.HSM_DATA.STATUS_LABEL[col]}
                {isPaused && <Icon name="clock" size={10} />}
                <span className="kcol__count">{items.length}</span>
              </div>
              {items.map(i => {
                const device = state.devices.find(d => d.id === i.deviceId);
                const tech = state.technicians.find(t => t.id === i.assigneeId);
                return (
                  <div key={i.id}
                       className={`kcard ${dragId === i.id ? 'is-dragging' : ''}`}
                       draggable
                       onDragStart={() => onDragStart(i.id)}
                       onDragEnd={onDragEnd}
                       onClick={() => onOpenIncident(i.id)}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <span className="kcard__id">{i.id}</span>
                      <PriorityPill priority={i.priority} />
                    </div>
                    <div className="kcard__title">{i.title}</div>
                    <div className="kcard__meta">
                      {device && <span className="flex items-center gap-2"><DeviceIcon type={device.type} size={12}/>{device.model.split(' ').slice(0,2).join(' ')}</span>}
                      <div className="kcard__meta-right">
                        {tech && <Avatar name={tech.name} initials={tech.initials} size="sm" />}
                      </div>
                    </div>
                    {i.rmaId && (
                      <div style={{marginTop:6}}>
                        <span className="badge badge--purple" style={{fontSize:9, padding:'2px 6px'}}>
                          <Icon name="rma" size={10}/> {i.rmaId}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {!items.length && <div className="muted text-xs" style={{padding:'12px 8px', textAlign:'center'}}>—</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { IncidentsScreen, KanbanScreen, EmptyState });
