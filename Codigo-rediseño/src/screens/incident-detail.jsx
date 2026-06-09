// ═══════════════════════════════════════════════════════════════
// Incident detail drawer + create/edit form
// ═══════════════════════════════════════════════════════════════
const { useState: detState, useRef: detRef, useEffect: detEffect } = React;

function IncidentDetail({ incidentId, state, setState, onClose, onConvertRma, onOpenRma }) {
  const inc = state.incidents.find(i => i.id === incidentId);
  if (!inc) return null;
  const device = state.devices.find(d => d.id === inc.deviceId);
  const tech = state.technicians.find(t => t.id === inc.assigneeId);
  const [tab, setTab] = detState('detalle');
  const [comment, setComment] = detState('');

  const update = (patch, activityEntry) => {
    const updated = state.incidents.map(i => {
      if (i.id !== inc.id) return i;
      const next = { ...i, ...patch, updatedAt: new Date().toISOString() };
      if (activityEntry) next.activity = [...(i.activity || []), activityEntry];
      return next;
    });
    setState({ ...state, incidents: updated });
  };

  const changeStatus = (status) => {
    const byName = state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema';
    const updated = state.incidents.map(i =>
      i.id === inc.id ? window.HSM_UTIL.transitionIncident(i, status, byName) : i
    );
    setState({ ...state, incidents: updated });
    const isPaused = window.HSM_DATA.PAUSED_STATUSES.has(status);
    window.HSM_TOAST?.(`Estado: ${window.HSM_DATA.STATUS_LABEL[status]}${isPaused ? ' · SLA pausado' : ''}`);
  };
  const changeAssignee = (uid) => {
    const u = state.technicians.find(t => t.id === uid);
    update({ assigneeId: uid }, {
      type: 'assigned', at: new Date().toISOString(),
      by: state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema',
      text: `Reasignó la incidencia a ${u?.name}.`,
    });
  };
  const changePriority = (priority) => {
    update({ priority }, {
      type: 'comment', at: new Date().toISOString(),
      by: state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema',
      text: `Prioridad cambiada a ${window.HSM_DATA.PRIORITY_LABEL[priority]}.`,
    });
  };
  const addComment = () => {
    if (!comment.trim()) return;
    update({}, {
      type: 'comment', at: new Date().toISOString(),
      by: state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema',
      text: comment.trim(),
    });
    setComment('');
  };
  const addAttachment = (file) => {
    const att = { name: file.name, size: `${(file.size/1024).toFixed(0)} KB` };
    update({ attachments: [...(inc.attachments || []), att] }, {
      type: 'comment', at: new Date().toISOString(),
      by: state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema',
      text: `Adjuntó archivo: ${file.name}`,
    });
    window.HSM_TOAST?.('Archivo adjuntado');
  };

  const footer = (
    <>
      <select className="select" style={{width:'auto'}} value={inc.status} onChange={e => changeStatus(e.target.value)}>
        {window.HSM_DATA.INCIDENT_STATUSES.map(s => <option key={s} value={s}>{window.HSM_DATA.STATUS_LABEL[s]}</option>)}
      </select>
      <div style={{flex:1}} />
      {!inc.rmaId && device && (
        <button className="btn btn--outline btn--sm" onClick={() => onConvertRma(inc)}>
          <Icon name="rma" size={14}/> Crear RMA
        </button>
      )}
      {!['resuelta','cerrada'].includes(inc.status) && (
        <button className="btn btn--secondary btn--sm" onClick={() => changeStatus('resuelta')}>
          <Icon name="check" size={14}/> Marcar resuelta
        </button>
      )}
    </>
  );

  return (
    <Drawer open={true} onClose={onClose}
            title={inc.title}
            subtitle={`${inc.id} · ${window.HSM_UTIL.formatDate(inc.openedAt)}`}
            footer={footer}
            width={760}>
      {/* status + priority + sla strip */}
      <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
        <StatusBadge status={inc.status} />
        <PriorityPill priority={inc.priority} />
        <SlaBar incident={inc} />
        {inc.rmaId && (
          <button className="badge badge--purple" style={{border:0, cursor:'pointer'}}
                  onClick={() => onOpenRma(inc.rmaId)}>
            <Icon name="rma" size={12}/> {inc.rmaId}
          </button>
        )}
      </div>

      {/* SLA paused banner */}
      {window.HSM_DATA.PAUSED_STATUSES.has(inc.status) && (
        <div style={{
          padding:'10px 14px', background:'var(--blue-50)', border:'1px solid var(--blue-500)',
          borderRadius:10, display:'flex', alignItems:'center', gap:10, fontSize:13,
        }}>
          <Icon name="clock" size={14} color="var(--blue-500)" />
          <div style={{flex:1, color:'var(--blue-900)'}}>
            <strong>SLA en pausa.</strong> El tiempo en <em>{window.HSM_DATA.STATUS_LABEL[inc.status]}</em> no cuenta para el plazo de resolución porque depende de un tercero.
          </div>
        </div>
      )}

      {/* tabs */}
      <div className="tabs">
        <button className={`tab ${tab==='detalle' ? 'is-active' : ''}`} onClick={() => setTab('detalle')}>Detalle</button>
        <button className={`tab ${tab==='timeline' ? 'is-active' : ''}`} onClick={() => setTab('timeline')}>Timeline ({(inc.activity||[]).length})</button>
        <button className={`tab ${tab==='adjuntos' ? 'is-active' : ''}`} onClick={() => setTab('adjuntos')}>Adjuntos ({(inc.attachments||[]).length})</button>
      </div>

      {tab === 'detalle' && (
        <div className="stack" style={{gap:20}}>
          <div>
            <div className="field__label" style={{marginBottom:6}}>Descripción</div>
            <div style={{background:'var(--gray-50)', padding:'12px 14px', borderRadius:10, fontSize:13, lineHeight:1.55, whiteSpace:'pre-line'}}>
              {inc.description}
            </div>
          </div>

          {device && (
            <div>
              <div className="field__label" style={{marginBottom:8}}>Equipo afectado</div>
              <div className="card card--pad" style={{padding:16, display:'flex', alignItems:'center', gap:14}}>
                <div style={{width:44, height:44, background:'var(--gray-100)', borderRadius:10, display:'grid', placeItems:'center', color:'var(--gray-700)'}}>
                  <DeviceIcon type={device.type} size={20} />
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="fw-700" style={{fontSize:14}}>{device.model}</div>
                  <div className="text-xs muted mono" style={{marginTop:2}}>Serie: {device.serial} · {device.type}</div>
                </div>
                <div className="text-xs muted" style={{textAlign:'right'}}>
                  <div>{device.assignee}</div>
                  <div className="mono">{device.dept}</div>
                </div>
              </div>
            </div>
          )}

          <div className="row row--2">
            <Field label="Técnico asignado">
              <select className="select" value={inc.assigneeId || ''} onChange={e => changeAssignee(e.target.value)}>
                {state.technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Prioridad">
              <select className="select" value={inc.priority} onChange={e => changePriority(e.target.value)}>
                {window.HSM_DATA.PRIORITIES.map(p => <option key={p} value={p}>{window.HSM_DATA.PRIORITY_LABEL[p]}</option>)}
              </select>
            </Field>
          </div>

          <dl className="dl">
            <dt>Reportador</dt><dd>{inc.reporter}</dd>
            <dt>Abierta</dt><dd>{window.HSM_UTIL.formatDate(inc.openedAt)}</dd>
            <dt>Última actualización</dt><dd>{window.HSM_UTIL.formatDate(inc.updatedAt, {relative:true})}</dd>
            <dt>SLA</dt><dd>{inc.slaHours}h · {window.HSM_UTIL.slaText(inc)}</dd>
          </dl>

          <Field label="Diagnóstico">
            <textarea className="textarea" placeholder="Pasos de diagnóstico, hallazgos…"
                      value={inc.diagnosis}
                      onChange={e => update({ diagnosis: e.target.value })} />
          </Field>

          <Field label="Solución aplicada">
            <textarea className="textarea" placeholder="Solución final aplicada (rellenar al cerrar)…"
                      value={inc.resolution}
                      onChange={e => update({ resolution: e.target.value })} />
          </Field>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="stack">
          <div className="timeline">
            {[...(inc.activity || [])].reverse().map((a, idx) => (
              <TimelineItem key={idx} entry={a} />
            ))}
          </div>
          <div style={{display:'flex', gap:8, marginTop:8}}>
            <input className="input" placeholder="Añadir nota o comentario…"
                   value={comment} onChange={e => setComment(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && addComment()} />
            <button className="btn btn--primary btn--sm" onClick={addComment} disabled={!comment.trim()}>Añadir</button>
          </div>
        </div>
      )}

      {tab === 'adjuntos' && (
        <div className="stack">
          <DropZone onFile={addAttachment} />
          <div className="attach-list">
            {(inc.attachments || []).length === 0 && <div className="muted text-sm">No hay archivos adjuntos.</div>}
            {(inc.attachments || []).map((a, idx) => (
              <div key={idx} className="attach-item">
                <Icon name="file" size={14} />
                <span className="attach-item__name">{a.name}</span>
                <span className="muted mono">{a.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ── Timeline item ─────────────────────────────────────────────
function TimelineItem({ entry }) {
  const cfg = {
    created: { icon: 'plus', cls: 'brand' },
    assigned: { icon: 'user', cls: '' },
    status: { icon: 'arrowRight', cls: 'info' },
    comment: { icon: 'edit', cls: '' },
    rma: { icon: 'rma', cls: 'brand' },
    resolved: { icon: 'check', cls: 'success' },
  }[entry.type] || { icon: 'edit', cls: '' };
  return (
    <div className="timeline__item">
      <div className={`timeline__dot timeline__dot--${cfg.cls}`}>
        <Icon name={cfg.icon} size={12} />
      </div>
      <div>
        <div className="timeline__content">
          <strong>{entry.by}</strong> · {entry.text}
        </div>
        <div className="timeline__meta">
          <Icon name="clock" size={10}/> {window.HSM_UTIL.formatDate(entry.at, {relative:true})}
        </div>
      </div>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────
function DropZone({ onFile }) {
  const [over, setOver] = detState(false);
  const inputRef = detRef();
  const handleFiles = (files) => {
    Array.from(files).forEach(f => onFile(f));
  };
  return (
    <div className={`dropzone ${over ? 'is-over' : ''}`}
         onDragOver={e => { e.preventDefault(); setOver(true); }}
         onDragLeave={() => setOver(false)}
         onDrop={e => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
         onClick={() => inputRef.current?.click()}>
      <Icon name="upload" size={20} />
      <div className="fw-600 text-sm" style={{marginTop:6}}>Arrastra archivos aquí o haz click</div>
      <div className="text-xs muted">JPG, PNG, PDF, TXT — máx 10MB (simulado)</div>
      <input ref={inputRef} type="file" multiple style={{display:'none'}}
             onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATE / EDIT INCIDENT
// ═══════════════════════════════════════════════════════════════
function IncidentForm({ open, state, setState, onClose, prefill }) {
  const empty = {
    title: '',
    description: '',
    deviceId: state.devices[0]?.id || '',
    priority: 'media',
    status: 'abierta',
    assigneeId: state.technicians[0]?.id || '',
    reporter: '',
    slaHours: 72,
  };
  const [form, setForm] = detState(prefill || empty);
  detEffect(() => { if (open) setForm(prefill || empty); }, [open]);

  if (!open) return null;
  const onSubmit = () => {
    if (!form.title.trim()) { window.HSM_TOAST?.('El título es obligatorio'); return; }
    const id = window.HSM_UTIL.nextIncidentId(state);
    const now = new Date().toISOString();
    const newInc = {
      ...form,
      id,
      openedAt: now,
      updatedAt: now,
      diagnosis: '',
      resolution: '',
      attachments: [],
      activity: [
        { type: 'created', at: now, by: form.reporter || 'Sistema', text: 'Creó la incidencia.' },
        { type: 'assigned', at: now,
          by: state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema',
          text: `Asignó a ${state.technicians.find(t => t.id === form.assigneeId)?.name}.` },
      ],
    };
    setState({ ...state, incidents: [newInc, ...state.incidents] });
    window.HSM_TOAST?.(`Incidencia ${id} creada`);
    onClose(id);
  };

  return (
    <Drawer open={open} onClose={() => onClose()}
            title="Nueva incidencia"
            subtitle="Crear un ticket de soporte hardware"
            width={680}
            footer={
              <>
                <button className="btn btn--ghost btn--sm" onClick={() => onClose()}>Cancelar</button>
                <div style={{flex:1}}/>
                <button className="btn btn--primary btn--sm" onClick={onSubmit}>
                  <Icon name="save" size={14}/> Crear incidencia
                </button>
              </>
            }>
      <Field label="Título *">
        <input className="input" placeholder="Ej. MacBook Pro no carga"
               value={form.title} onChange={e => setForm({...form, title: e.target.value})} autoFocus />
      </Field>
      <Field label="Descripción detallada">
        <textarea className="textarea" placeholder="Pasos para reproducir, comportamiento observado, mensajes de error…"
                  value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
      </Field>
      <div className="row row--2">
        <Field label="Equipo afectado">
          <select className="select" value={form.deviceId} onChange={e => setForm({...form, deviceId: e.target.value})}>
            {state.devices.map(d => <option key={d.id} value={d.id}>{d.model} · {d.serial}</option>)}
          </select>
        </Field>
        <Field label="Reportador" hint="Nombre del usuario afectado">
          <input className="input" placeholder="Ej. Carlos Vega"
                 value={form.reporter} onChange={e => setForm({...form, reporter: e.target.value})} />
        </Field>
      </div>
      <div className="row row--3">
        <Field label="Prioridad">
          <select className="select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
            {window.HSM_DATA.PRIORITIES.map(p => <option key={p} value={p}>{window.HSM_DATA.PRIORITY_LABEL[p]}</option>)}
          </select>
        </Field>
        <Field label="Técnico asignado">
          <select className="select" value={form.assigneeId} onChange={e => setForm({...form, assigneeId: e.target.value})}>
            {state.technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="SLA (horas)">
          <select className="select" value={form.slaHours} onChange={e => setForm({...form, slaHours: Number(e.target.value)})}>
            <option value={24}>24h — Crítica</option>
            <option value={48}>48h — Alta</option>
            <option value={72}>72h — Estándar</option>
            <option value={120}>120h — Baja</option>
          </select>
        </Field>
      </div>
    </Drawer>
  );
}

Object.assign(window, { IncidentDetail, IncidentForm, DropZone });
