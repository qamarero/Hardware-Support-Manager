// ═══════════════════════════════════════════════════════════════
// RMA — list, detail, create-from-incident, vendors
// ═══════════════════════════════════════════════════════════════
const { useState: rmaState, useMemo: rmaMemo, useEffect: rmaEffect } = React;

const RMA_STATUSES = ['solicitado', 'autorizado', 'enviado', 'recibido', 'sustituido', 'cerrado'];

function RmaScreen({ state, setState, onOpenRma, onCreateRma }) {
  const [filterStatus, setFilterStatus] = rmaState('all');
  const [query, setQuery] = rmaState('');

  const filtered = rmaMemo(() => {
    let arr = state.rmas.slice();
    if (filterStatus !== 'all') arr = arr.filter(r => r.status === filterStatus);
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(r => {
        const v = state.vendors.find(x => x.id === r.vendorId);
        const d = state.devices.find(x => x.id === r.deviceId);
        return (
          r.id.toLowerCase().includes(q) ||
          (r.vendorRmaNumber||'').toLowerCase().includes(q) ||
          (v?.name||'').toLowerCase().includes(q) ||
          (d?.model||'').toLowerCase().includes(q) ||
          (d?.serial||'').toLowerCase().includes(q)
        );
      });
    }
    arr.sort((a,b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    return arr;
  }, [state.rmas, filterStatus, query, state.vendors, state.devices]);

  const counts = rmaMemo(() => {
    const c = { all: state.rmas.length };
    RMA_STATUSES.forEach(s => { c[s] = state.rmas.filter(r => r.status === s).length; });
    return c;
  }, [state.rmas]);

  const onExport = () => {
    const rows = filtered.map(r => {
      const v = state.vendors.find(x => x.id === r.vendorId);
      const d = state.devices.find(x => x.id === r.deviceId);
      return {
        ID: r.id,
        RMA_proveedor: r.vendorRmaNumber,
        Proveedor: v?.name || '',
        Equipo: d ? `${d.model} (${d.serial})` : '',
        Estado: window.HSM_DATA.RMA_STATUS_LABEL[r.status],
        Motivo: r.reason,
        Solicitado: new Date(r.requestedAt).toLocaleDateString('es-ES'),
        Enviado: r.shippedAt ? new Date(r.shippedAt).toLocaleDateString('es-ES') : '',
        Recibido: r.receivedAt ? new Date(r.receivedAt).toLocaleDateString('es-ES') : '',
        Sustituto: r.replacementSerial || '',
        Incidencia: r.incidentId || '',
      };
    });
    window.HSM_UTIL.exportCsv(`rma_${new Date().toISOString().slice(0,10)}.csv`, rows);
    window.HSM_TOAST?.('CSV descargado');
  };

  return (
    <div className="stack">
      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        <div className="search" style={{flex:1, maxWidth:360}}>
          <Icon name="search" size={14}/>
          <input placeholder="Buscar por ID, número de proveedor, modelo…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div style={{flex:1}}/>
        <button className="btn btn--outline btn--sm" onClick={onExport}><Icon name="download" size={14}/> CSV</button>
        <button className="btn btn--primary btn--sm" onClick={() => onCreateRma()}>
          <Icon name="plus" size={14}/> Nuevo RMA
        </button>
      </div>

      <div className="filterbar">
        <button className={`chip ${filterStatus==='all' ? 'is-active' : ''}`} onClick={() => setFilterStatus('all')}>
          Todos <span className="chip__count">{counts.all}</span>
        </button>
        {RMA_STATUSES.map(s => (
          <button key={s} className={`chip ${filterStatus===s ? 'is-active' : ''}`} onClick={() => setFilterStatus(s)}>
            {window.HSM_DATA.RMA_STATUS_LABEL[s]} <span className="chip__count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <EmptyState icon="rma" title="No hay RMA" subtitle="Ningún RMA con esos filtros." />
      ) : (
        <div className="table-wrap">
          <table className="table table--dense">
            <thead>
              <tr>
                <th>ID interno</th>
                <th>Nº proveedor</th>
                <th>Proveedor</th>
                <th>Equipo</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Solicitado</th>
                <th>Incidencia</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const v = state.vendors.find(x => x.id === r.vendorId);
                const d = state.devices.find(x => x.id === r.deviceId);
                return (
                  <tr key={r.id} onClick={() => onOpenRma(r.id)}>
                    <td className="id-cell">{r.id}</td>
                    <td className="mono text-sm fw-600">{r.vendorRmaNumber}</td>
                    <td className="text-sm">{v?.name || '—'}</td>
                    <td className="text-sm">
                      {d ? (
                        <div className="flex items-center gap-2">
                          <DeviceIcon type={d.type} size={14}/>
                          <div>
                            <div style={{fontWeight:500}}>{d.model}</div>
                            <div className="mono text-xs muted">{d.serial}</div>
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="text-sm" style={{maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.reason}</td>
                    <td><StatusBadge status={r.status} type="rma" /></td>
                    <td className="text-sm muted">{window.HSM_UTIL.formatDate(r.requestedAt, {short:true})}</td>
                    <td className="id-cell">{r.incidentId || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── RMA detail ────────────────────────────────────────────────
function RmaDetail({ rmaId, state, setState, onClose, onOpenIncident }) {
  const r = state.rmas.find(x => x.id === rmaId);
  if (!r) return null;
  const v = state.vendors.find(x => x.id === r.vendorId);
  const d = state.devices.find(x => x.id === r.deviceId);

  const update = (patch) => {
    setState({
      ...state,
      rmas: state.rmas.map(x => x.id === r.id ? { ...x, ...patch } : x),
    });
  };

  const advance = (next) => {
    const now = new Date().toISOString();
    const patch = { status: next };
    if (next === 'enviado' && !r.shippedAt) patch.shippedAt = now;
    if (next === 'recibido' && !r.receivedAt) patch.receivedAt = now;
    if (next === 'sustituido' && !r.resolvedAt) patch.resolvedAt = now;
    if (next === 'cerrado' && !r.resolvedAt) patch.resolvedAt = now;
    update(patch);
    window.HSM_TOAST?.(`RMA → ${window.HSM_DATA.RMA_STATUS_LABEL[next]}`);
  };

  const stages = ['solicitado','autorizado','enviado','recibido','sustituido','cerrado'];
  const currentIdx = stages.indexOf(r.status);

  const footer = (
    <>
      <select className="select" style={{width:'auto'}} value={r.status} onChange={e => advance(e.target.value)}>
        {RMA_STATUSES.map(s => <option key={s} value={s}>{window.HSM_DATA.RMA_STATUS_LABEL[s]}</option>)}
      </select>
      <div style={{flex:1}}/>
      {currentIdx < stages.length - 1 && (
        <button className="btn btn--primary btn--sm" onClick={() => advance(stages[currentIdx + 1])}>
          Avanzar a {window.HSM_DATA.RMA_STATUS_LABEL[stages[currentIdx + 1]]} <Icon name="arrowRight" size={12}/>
        </button>
      )}
    </>
  );

  return (
    <Drawer open={true} onClose={onClose}
            title={`RMA ${r.id}`}
            subtitle={`Nº proveedor ${r.vendorRmaNumber}`}
            footer={footer}
            width={760}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <StatusBadge status={r.status} type="rma" />
        {r.incidentId && (
          <button className="badge badge--outline" style={{cursor:'pointer'}}
                  onClick={() => onOpenIncident(r.incidentId)}>
            <Icon name="ticket" size={12}/> Incidencia {r.incidentId}
          </button>
        )}
      </div>

      {/* Stepper */}
      <div className="card card--pad" style={{padding:20}}>
        <div className="field__label" style={{marginBottom:14}}>Progreso</div>
        <div style={{display:'flex', alignItems:'flex-start', gap:0}}>
          {stages.map((s, idx) => {
            const isDone = idx <= currentIdx;
            const isActive = idx === currentIdx;
            return (
              <React.Fragment key={s}>
                <div style={{textAlign:'center', flex:'0 0 auto', width:80}}>
                  <div style={{
                    width:28, height:28, borderRadius:50,
                    background: isDone ? 'var(--primary)' : 'var(--gray-200)',
                    color: isDone ? '#fff' : 'var(--gray-500)',
                    display:'grid', placeItems:'center', margin:'0 auto',
                    fontWeight:700, fontSize:11,
                    border: isActive ? '3px solid var(--orange-200)' : 'none',
                  }}>
                    {isDone && !isActive ? <Icon name="check" size={12}/> : idx + 1}
                  </div>
                  <div style={{fontSize:10, marginTop:6, color: isDone ? 'var(--fg-primary)' : 'var(--fg-tertiary)', fontWeight:isActive?700:500}}>
                    {window.HSM_DATA.RMA_STATUS_LABEL[s]}
                  </div>
                </div>
                {idx < stages.length - 1 && (
                  <div style={{
                    flex:1, height:2, marginTop:14,
                    background: idx < currentIdx ? 'var(--primary)' : 'var(--gray-200)',
                  }}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {d && (
        <Field label="Equipo afectado">
          <div className="card card--pad" style={{padding:16, display:'flex', alignItems:'center', gap:14}}>
            <div style={{width:44, height:44, background:'var(--gray-100)', borderRadius:10, display:'grid', placeItems:'center'}}>
              <DeviceIcon type={d.type} size={20} />
            </div>
            <div style={{flex:1}}>
              <div className="fw-700 text-sm">{d.model}</div>
              <div className="text-xs muted mono">Serie: {d.serial} · {d.type}</div>
            </div>
          </div>
        </Field>
      )}

      <Field label="Proveedor">
        <div style={{padding:12, background:'var(--gray-50)', borderRadius:10, fontSize:13}}>
          <div className="fw-700">{v?.name}</div>
          <div className="muted text-xs mono">{v?.contact}</div>
          <div className="muted text-xs">SLA: {v?.sla}</div>
        </div>
      </Field>

      <Field label="Motivo de la devolución">
        <textarea className="textarea" value={r.reason} onChange={e => update({reason: e.target.value})} />
      </Field>

      <div className="row row--2">
        <Field label="Nº RMA del proveedor">
          <input className="input mono" value={r.vendorRmaNumber} onChange={e => update({vendorRmaNumber: e.target.value})} />
        </Field>
        <Field label="Serie del sustituto" hint="Cuando se reciba el reemplazo">
          <input className="input mono" placeholder="Pendiente" value={r.replacementSerial || ''} onChange={e => update({replacementSerial: e.target.value})} />
        </Field>
      </div>

      <div className="row row--3">
        <Field label="Fecha solicitud">
          <input className="input" type="date" value={r.requestedAt?.slice(0,10) || ''} readOnly />
        </Field>
        <Field label="Fecha envío">
          <input className="input" type="date" value={r.shippedAt?.slice(0,10) || ''}
                 onChange={e => update({shippedAt: e.target.value ? new Date(e.target.value).toISOString() : null})} />
        </Field>
        <Field label="Fecha recepción">
          <input className="input" type="date" value={r.receivedAt?.slice(0,10) || ''}
                 onChange={e => update({receivedAt: e.target.value ? new Date(e.target.value).toISOString() : null})} />
        </Field>
      </div>

      <Field label="Notas">
        <textarea className="textarea" value={r.notes || ''} onChange={e => update({notes: e.target.value})} />
      </Field>
    </Drawer>
  );
}

// ── Convert Incident → RMA ────────────────────────────────────
function RmaForm({ open, state, setState, onClose, incident }) {
  const device = incident ? state.devices.find(d => d.id === incident.deviceId) : null;
  const defaultVendor = device ? device.vendor : state.vendors[0]?.id;
  const initial = {
    vendorId: defaultVendor,
    vendorRmaNumber: '',
    deviceId: incident?.deviceId || state.devices[0]?.id,
    incidentId: incident?.id || '',
    reason: incident ? `${incident.title} — ${incident.diagnosis || incident.description}`.slice(0, 200) : '',
    status: 'solicitado',
    notes: '',
  };
  const [form, setForm] = rmaState(initial);
  rmaEffect(() => { if (open) setForm(initial); }, [open, incident?.id]);

  if (!open) return null;

  const onSubmit = () => {
    if (!form.vendorRmaNumber.trim() || !form.reason.trim()) {
      window.HSM_TOAST?.('Completa nº de proveedor y motivo'); return;
    }
    const id = window.HSM_UTIL.nextRmaId(state);
    const now = new Date().toISOString();
    const newRma = {
      ...form,
      id,
      requestedAt: now,
      authorizedAt: null,
      shippedAt: null,
      receivedAt: null,
      resolvedAt: null,
      replacementSerial: null,
      cost: 0,
    };
    let updatedIncidents = state.incidents;
    if (incident) {
      const byName = state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema';
      updatedIncidents = state.incidents.map(i => {
        if (i.id !== incident.id) return i;
        let next = i;
        if (['abierta','en_curso'].includes(i.status)) {
          next = window.HSM_UTIL.transitionIncident(i, 'esperando_pieza', byName);
        }
        return {
          ...next,
          rmaId: id,
          updatedAt: now,
          activity: [...(next.activity || []), {
            type: 'rma', at: now, by: byName,
            text: `Abrió RMA ${id} con ${state.vendors.find(v=>v.id===form.vendorId)?.name}.`,
          }],
        };
      });
    }
    setState({ ...state, rmas: [newRma, ...state.rmas], incidents: updatedIncidents });
    window.HSM_TOAST?.(`RMA ${id} creado`);
    onClose(id);
  };

  return (
    <Drawer open={open} onClose={() => onClose()}
            title={incident ? `Crear RMA para ${incident.id}` : 'Nuevo RMA'}
            subtitle="Devolución a proveedor / fabricante"
            width={680}
            footer={
              <>
                <button className="btn btn--ghost btn--sm" onClick={() => onClose()}>Cancelar</button>
                <div style={{flex:1}}/>
                <button className="btn btn--primary btn--sm" onClick={onSubmit}>
                  <Icon name="save" size={14}/> Crear RMA
                </button>
              </>
            }>
      {incident && (
        <div style={{background:'var(--orange-50)', borderRadius:10, padding:12, fontSize:13}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <Icon name="ticket" size={14} color="var(--primary)"/>
            <span className="fw-700">Incidencia vinculada:</span>
            <span className="mono">{incident.id}</span>
          </div>
          <div style={{marginTop:4, color:'var(--fg-secondary)'}}>{incident.title}</div>
        </div>
      )}

      <Field label="Proveedor *">
        <select className="select" value={form.vendorId} onChange={e => setForm({...form, vendorId: e.target.value})}>
          {state.vendors.map(v => <option key={v.id} value={v.id}>{v.name} · {v.sla}</option>)}
        </select>
      </Field>

      <Field label="Equipo *">
        <select className="select" value={form.deviceId} onChange={e => setForm({...form, deviceId: e.target.value})}>
          {state.devices.map(d => <option key={d.id} value={d.id}>{d.model} · {d.serial}</option>)}
        </select>
      </Field>

      <Field label="Nº RMA del proveedor *" hint="Código devuelto por el proveedor al autorizar la devolución">
        <input className="input mono" placeholder="Ej. DL-RMA-87423-ES"
               value={form.vendorRmaNumber} onChange={e => setForm({...form, vendorRmaNumber: e.target.value})} autoFocus />
      </Field>

      <Field label="Motivo de la devolución *">
        <textarea className="textarea" placeholder="Diagnóstico, qué falla, qué se ha probado…"
                  value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} />
      </Field>

      <Field label="Estado inicial">
        <select className="select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
          {RMA_STATUSES.map(s => <option key={s} value={s}>{window.HSM_DATA.RMA_STATUS_LABEL[s]}</option>)}
        </select>
      </Field>

      <Field label="Notas">
        <textarea className="textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
      </Field>
    </Drawer>
  );
}

// ═══════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════
function InventoryScreen({ state, onOpenIncident }) {
  const [query, setQuery] = rmaState('');
  const [filterType, setFilterType] = rmaState('all');

  const types = Array.from(new Set(state.devices.map(d => d.type)));

  const filtered = rmaMemo(() => {
    let arr = state.devices.slice();
    if (filterType !== 'all') arr = arr.filter(d => d.type === filterType);
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(d =>
        d.model.toLowerCase().includes(q) ||
        d.serial.toLowerCase().includes(q) ||
        (d.assignee||'').toLowerCase().includes(q) ||
        (d.dept||'').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [state.devices, query, filterType]);

  const incidentsByDevice = rmaMemo(() => {
    const map = {};
    state.incidents.forEach(i => {
      if (!map[i.deviceId]) map[i.deviceId] = [];
      map[i.deviceId].push(i);
    });
    return map;
  }, [state.incidents]);

  const onExport = () => {
    const rows = filtered.map(d => ({
      Modelo: d.model,
      Serie: d.serial,
      Tipo: d.type,
      Asignado_a: d.assignee,
      Departamento: d.dept,
      Proveedor: state.vendors.find(v=>v.id===d.vendor)?.name || '',
      Garantía_hasta: d.warranty,
      Incidencias_totales: (incidentsByDevice[d.id]||[]).length,
    }));
    window.HSM_UTIL.exportCsv(`inventario_${new Date().toISOString().slice(0,10)}.csv`, rows);
    window.HSM_TOAST?.('CSV descargado');
  };

  return (
    <div className="stack">
      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        <div className="search" style={{flex:1, maxWidth:360}}>
          <Icon name="search" size={14}/>
          <input placeholder="Buscar por modelo, serie, persona…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select className="select" style={{width:'auto'}} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">Todos los tipos</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{flex:1}}/>
        <button className="btn btn--outline btn--sm" onClick={onExport}><Icon name="download" size={14}/> CSV</button>
      </div>

      <div className="kpi-grid">
        {types.map(t => {
          const count = state.devices.filter(d => d.type === t).length;
          return (
            <div key={t} className="kpi" style={{cursor:'pointer'}} onClick={() => setFilterType(t)}>
              <div className="kpi__label">{t}</div>
              <div className="kpi__value">{count}</div>
            </div>
          );
        })}
      </div>

      <div className="table-wrap">
        <table className="table table--dense">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Modelo</th>
              <th>Serie</th>
              <th>Asignado a</th>
              <th>Departamento</th>
              <th>Proveedor</th>
              <th>Garantía</th>
              <th>Incidencias</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const v = state.vendors.find(x => x.id === d.vendor);
              const incs = incidentsByDevice[d.id] || [];
              const open = incs.filter(i => !['resuelta','cerrada'].includes(i.status)).length;
              const warrantyDate = new Date(d.warranty);
              const isExpiring = (warrantyDate - Date.now()) < 90 * 86400000;
              return (
                <tr key={d.id} onClick={() => {
                  if (incs[0]) onOpenIncident(incs[0].id);
                }}>
                  <td><DeviceIcon type={d.type} size={16} /></td>
                  <td className="fw-600">{d.model}</td>
                  <td className="mono text-xs">{d.serial}</td>
                  <td className="text-sm">{d.assignee}</td>
                  <td className="text-sm muted">{d.dept}</td>
                  <td className="text-sm">{v?.name}</td>
                  <td className="text-sm">
                    <span className={isExpiring ? 'badge badge--amber' : 'badge badge--gray'}>
                      {new Date(d.warranty).toLocaleDateString('es-ES', { month:'short', year:'numeric' })}
                    </span>
                  </td>
                  <td>
                    {incs.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="badge badge--gray">{incs.length} total</span>
                        {open > 0 && <span className="badge badge--orange">{open} abierta{open!==1?'s':''}</span>}
                      </div>
                    ) : <span className="text-xs muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VENDORS
// ═══════════════════════════════════════════════════════════════
function VendorsScreen({ state }) {
  return (
    <div className="stack">
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:14}}>
        {state.vendors.map(v => {
          const rmas = state.rmas.filter(r => r.vendorId === v.id);
          const active = rmas.filter(r => r.status !== 'cerrado');
          const devices = state.devices.filter(d => d.vendor === v.id);
          return (
            <div key={v.id} className="card card--pad">
              <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
                <div style={{
                  width:44, height:44, background:'var(--gray-900)', color:'#fff',
                  borderRadius:10, display:'grid', placeItems:'center', fontWeight:700, fontSize:16,
                  flexShrink:0,
                }}>{v.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="fw-700">{v.name}</div>
                  <div className="text-xs muted mono">{v.contact}</div>
                </div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginTop:16}}>
                <div>
                  <div className="text-xs muted">Equipos</div>
                  <div className="fw-700 mono" style={{fontSize:18}}>{devices.length}</div>
                </div>
                <div>
                  <div className="text-xs muted">RMA activos</div>
                  <div className="fw-700 mono" style={{fontSize:18, color: active.length ? 'var(--primary)' : 'inherit'}}>{active.length}</div>
                </div>
                <div>
                  <div className="text-xs muted">SLA</div>
                  <div className="fw-700" style={{fontSize:12, marginTop:3}}>{v.sla}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { RmaScreen, RmaDetail, RmaForm, InventoryScreen, VendorsScreen });
