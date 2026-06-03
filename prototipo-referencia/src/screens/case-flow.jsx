// ═══════════════════════════════════════════════════════════════
// Case flow — RMA conversion wizard + unified Cases pipeline
// ═══════════════════════════════════════════════════════════════
const { useState: cfState, useMemo: cfMemo, useEffect: cfEffect } = React;

// Common reason templates (Spanish, hardware support context)
const REASON_TEMPLATES = [
  { id: 'hw_fail', icon: 'alert', title: 'Fallo de hardware confirmado',
    text: 'Tras diagnóstico se confirma fallo de hardware. Pruebas realizadas descartan software y configuración. Se solicita sustitución bajo garantía.' },
  { id: 'screen', icon: 'monitor', title: 'Pantalla / display dañado',
    text: 'Panel con líneas, parpadeo o píxeles muertos. Confirmado mediante prueba con monitor externo (descarta GPU).' },
  { id: 'battery', icon: 'sparkles', title: 'Batería degradada',
    text: 'Autonomía muy por debajo de lo esperado. Diagnóstico del sistema confirma capacidad degradada / ciclos excesivos.' },
  { id: 'noboot', icon: 'alert', title: 'Equipo no enciende',
    text: 'El equipo no responde al botón de encendido. Pruebas con cargador propio y de préstamo, descartados ambos. Posible fallo de placa o circuito de alimentación.' },
  { id: 'overheat', icon: 'alert', title: 'Sobrecalentamiento / apagones',
    text: 'Equipo se apaga por temperatura tras X minutos de uso. Limpieza y pasta térmica aplicadas sin éxito.' },
  { id: 'periph', icon: 'mouse', title: 'Periférico no funcional',
    text: 'Periférico no se conecta o pierde conexión repetidamente. Probado en varios equipos y puertos.' },
  { id: 'physical', icon: 'alert', title: 'Daño físico (no cubierto)',
    text: 'Daño físico visible. Consultar con proveedor sobre coberturas accidentales.' },
  { id: 'other', icon: 'edit', title: 'Otro motivo',
    text: '' },
];

// ═══════════════════════════════════════════════════════════════
// WIZARD — 3 pasos
// ═══════════════════════════════════════════════════════════════
function RmaWizard({ open, state, setState, onClose, incident }) {
  const device = incident ? state.devices.find(d => d.id === incident.deviceId) : null;
  const defaultVendor = device ? device.vendor : state.vendors[0]?.id;
  const empty = {
    vendorId: defaultVendor,
    deviceId: incident?.deviceId || state.devices[0]?.id,
    vendorRmaNumber: '',
    templateId: null,
    reason: '',
    notes: '',
    urgency: 'normal',
    incidentId: incident?.id || '',
  };
  const [form, setForm] = cfState(empty);
  const [step, setStep] = cfState(0);

  cfEffect(() => {
    if (open) { setForm(empty); setStep(0); }
  }, [open, incident?.id]);

  if (!open) return null;

  const vendor = state.vendors.find(v => v.id === form.vendorId);
  const dev = state.devices.find(d => d.id === form.deviceId);

  const pickTemplate = (tpl) => {
    setForm({
      ...form,
      templateId: tpl.id,
      reason: incident && tpl.id !== 'other'
        ? `${tpl.title}.\n\n${tpl.text}\n\nContexto: ${incident.title}${incident.diagnosis ? `\n\nDiagnóstico técnico: ${incident.diagnosis}` : ''}`
        : tpl.text,
    });
  };

  const validateStep = () => {
    if (step === 0) return !!form.vendorId && !!form.deviceId;
    if (step === 1) return !!form.reason.trim();
    if (step === 2) return !!form.vendorRmaNumber.trim();
    return true;
  };

  const onSubmit = () => {
    if (!form.vendorRmaNumber.trim()) {
      window.HSM_TOAST?.('Falta el nº de RMA del proveedor');
      return;
    }
    const id = window.HSM_UTIL.nextRmaId(state);
    const now = new Date().toISOString();
    const newRma = {
      id,
      vendorRmaNumber: form.vendorRmaNumber.trim(),
      vendorId: form.vendorId,
      deviceId: form.deviceId,
      incidentId: form.incidentId || null,
      reason: form.reason,
      status: 'solicitado',
      requestedAt: now,
      authorizedAt: null,
      shippedAt: null,
      receivedAt: null,
      resolvedAt: null,
      replacementSerial: null,
      cost: 0,
      notes: form.notes,
      urgency: form.urgency,
    };
    let updatedIncidents = state.incidents;
    if (incident) {
      const byName = state.technicians.find(t => t.id === state.currentUserId)?.name || 'Sistema';
      updatedIncidents = state.incidents.map(i => {
        if (i.id !== incident.id) return i;
        // Si la incidencia estaba en abierta o en_curso, transicionar a esperando_pieza
        // (esto pausará el SLA correctamente vía transitionIncident).
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
            text: `Abrió RMA ${id} con ${vendor?.name}.`,
          }],
        };
      });
    }
    setState({ ...state, rmas: [newRma, ...state.rmas], incidents: updatedIncidents });
    window.HSM_TOAST?.(`RMA ${id} creado correctamente`);
    onClose(id);
  };

  const footer = (
    <>
      <button className="btn btn--ghost btn--sm" onClick={() => onClose()}>Cancelar</button>
      <div style={{flex:1}}/>
      {step > 0 && (
        <button className="btn btn--outline btn--sm" onClick={() => setStep(step-1)}>
          <Icon name="chevronLeft" size={14}/> Atrás
        </button>
      )}
      {step < 2 ? (
        <button className="btn btn--primary btn--sm" disabled={!validateStep()}
                onClick={() => setStep(step+1)}>
          Siguiente <Icon name="arrowRight" size={14}/>
        </button>
      ) : (
        <button className="btn btn--primary btn--sm" disabled={!validateStep()} onClick={onSubmit}>
          <Icon name="check" size={14}/> Crear RMA
        </button>
      )}
    </>
  );

  return (
    <Drawer open={open} onClose={() => onClose()}
            title={incident ? `Convertir ${incident.id} → RMA` : 'Nuevo RMA'}
            subtitle={incident ? incident.title : 'Devolución a proveedor / fabricante'}
            width={760}
            footer={footer}>
      {/* Stepper */}
      <WizardStepper step={step} steps={['Equipo y proveedor', 'Motivo', 'Confirmar']} />

      {step === 0 && (
        <WizardStep1 form={form} setForm={setForm} state={state} incident={incident} />
      )}
      {step === 1 && (
        <WizardStep2 form={form} setForm={setForm} pickTemplate={pickTemplate} />
      )}
      {step === 2 && (
        <WizardStep3 form={form} setForm={setForm} vendor={vendor} device={dev} incident={incident}
                     state={state} />
      )}
    </Drawer>
  );
}

function WizardStepper({ step, steps }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, padding:'4px 0 8px'}}>
      {steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <React.Fragment key={label}>
            <div style={{display:'flex', alignItems:'center', gap:8, flex:'0 0 auto'}}>
              <div style={{
                width:24, height:24, borderRadius:50,
                background: (done || active) ? 'var(--primary)' : 'var(--gray-200)',
                color: (done || active) ? '#fff' : 'var(--gray-500)',
                display:'grid', placeItems:'center',
                fontWeight:700, fontSize:11,
                transition: 'background 0.2s',
              }}>
                {done ? <Icon name="check" size={12}/> : i + 1}
              </div>
              <span style={{fontSize:13, fontWeight: active ? 700 : 500,
                            color: active ? 'var(--fg-primary)' : 'var(--fg-secondary)'}}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{flex:1, height:2, background: i < step ? 'var(--primary)' : 'var(--gray-200)', borderRadius:1}}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: equipo + proveedor ────────────────────────────────
function WizardStep1({ form, setForm, state, incident }) {
  const device = state.devices.find(d => d.id === form.deviceId);
  const suggested = device ? device.vendor : null;
  return (
    <div className="stack" style={{gap:20}}>
      {incident && (
        <div style={{background:'var(--orange-50)', border:'1px solid var(--orange-200)', borderRadius:10, padding:12, fontSize:13, display:'flex', alignItems:'center', gap:10}}>
          <Icon name="ticket" size={16} color="var(--primary)"/>
          <div style={{flex:1}}>
            <div className="fw-700">Incidencia vinculada</div>
            <div className="text-xs muted">Se asociará automáticamente al crear el RMA</div>
          </div>
          <span className="mono fw-700 text-sm">{incident.id}</span>
        </div>
      )}

      <Field label="Equipo a devolver">
        <select className="select" value={form.deviceId} onChange={e => {
          const newDev = state.devices.find(d => d.id === e.target.value);
          setForm({ ...form, deviceId: e.target.value, vendorId: newDev?.vendor || form.vendorId });
        }}>
          {state.devices.map(d => <option key={d.id} value={d.id}>{d.model} · {d.serial} ({d.type})</option>)}
        </select>
      </Field>

      {device && (
        <div className="card card--pad" style={{padding:14, display:'flex', alignItems:'center', gap:14}}>
          <div style={{width:48, height:48, background:'var(--gray-100)', borderRadius:10, display:'grid', placeItems:'center'}}>
            <DeviceIcon type={device.type} size={22} />
          </div>
          <div style={{flex:1}}>
            <div className="fw-700">{device.model}</div>
            <div className="text-xs muted mono">{device.serial} · {device.type}</div>
            <div className="text-xs muted" style={{marginTop:2}}>Asignado a {device.assignee} · {device.dept}</div>
          </div>
          {device.warranty && (
            <div style={{textAlign:'right'}}>
              <div className="text-xs muted">Garantía</div>
              <div className="fw-700 mono text-sm">{new Date(device.warranty).toLocaleDateString('es-ES', {month:'short', year:'numeric'})}</div>
            </div>
          )}
        </div>
      )}

      <div>
        <Field label="Proveedor / fabricante" hint={suggested === form.vendorId ? '✓ Sugerido a partir del equipo' : 'Cambia si la garantía se gestiona por otro canal'}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
            {state.vendors.map(v => {
              const isSelected = form.vendorId === v.id;
              const isSuggested = suggested === v.id;
              return (
                <button key={v.id} type="button"
                        onClick={() => setForm({...form, vendorId: v.id})}
                        style={{
                          textAlign:'left', cursor:'pointer',
                          padding:12,
                          background: isSelected ? 'var(--orange-50)' : '#fff',
                          border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                          borderRadius:10,
                          transition:'all 0.15s',
                        }}>
                  <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                    <div style={{
                      width:32, height:32, borderRadius:8,
                      background: isSelected ? 'var(--primary)' : 'var(--gray-900)',
                      color:'#fff', display:'grid', placeItems:'center',
                      fontWeight:700, fontSize:12, flexShrink:0,
                    }}>{v.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div className="fw-700 text-sm">{v.name}</div>
                      <div className="text-xs muted">SLA {v.sla}</div>
                      {isSuggested && (
                        <span className="badge badge--green" style={{marginTop:4, fontSize:9}}>SUGERIDO</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </div>
  );
}

// ── Step 2: motivo con plantillas ─────────────────────────────
function WizardStep2({ form, setForm, pickTemplate }) {
  return (
    <div className="stack" style={{gap:20}}>
      <div>
        <div className="field__label" style={{marginBottom:8}}>Plantilla de motivo</div>
        <div className="text-xs muted" style={{marginBottom:12}}>Elige una plantilla y personaliza el texto. Acelera el proceso y mantiene consistencia entre tickets.</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
          {REASON_TEMPLATES.map(tpl => {
            const isSelected = form.templateId === tpl.id;
            return (
              <button key={tpl.id} type="button" onClick={() => pickTemplate(tpl)}
                      style={{
                        textAlign:'left', cursor:'pointer',
                        padding:12,
                        background: isSelected ? 'var(--orange-50)' : '#fff',
                        border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                        borderRadius:10,
                        display:'flex', alignItems:'center', gap:10,
                        transition:'all 0.15s',
                      }}>
                <div style={{
                  width:32, height:32, borderRadius:8,
                  background: isSelected ? 'var(--primary)' : 'var(--gray-100)',
                  color: isSelected ? '#fff' : 'var(--gray-700)',
                  display:'grid', placeItems:'center', flexShrink:0,
                }}>
                  <Icon name={tpl.icon} size={16} />
                </div>
                <div className="fw-600 text-sm" style={{flex:1, minWidth:0}}>{tpl.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Motivo de la devolución" hint="Edita libremente; será visible al proveedor en la solicitud">
        <textarea className="textarea" style={{minHeight:140}}
                  placeholder="Describe el problema, diagnóstico realizado y por qué se solicita la devolución…"
                  value={form.reason}
                  onChange={e => setForm({...form, reason: e.target.value})} autoFocus />
      </Field>

      <Field label="Urgencia interna" hint="Para priorización propia. No afecta al SLA del proveedor">
        <div style={{display:'flex', gap:8}}>
          {[{v:'baja',l:'Baja'},{v:'normal',l:'Normal'},{v:'alta',l:'Alta'},{v:'critica',l:'Crítica'}].map(o => (
            <button key={o.v} type="button"
                    onClick={() => setForm({...form, urgency: o.v})}
                    className={`chip ${form.urgency === o.v ? 'is-active' : ''}`}>
              {o.l}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

// ── Step 3: confirmar ─────────────────────────────────────────
function WizardStep3({ form, setForm, vendor, device, incident, state }) {
  return (
    <div className="stack" style={{gap:20}}>
      <div style={{background:'var(--gray-50)', borderRadius:12, padding:18}}>
        <div className="field__label" style={{marginBottom:14}}>Resumen del RMA a crear</div>
        <dl className="dl" style={{gridTemplateColumns:'180px 1fr'}}>
          {incident && <>
            <dt>Incidencia origen</dt><dd className="mono fw-700">{incident.id}</dd>
          </>}
          <dt>Proveedor</dt>
          <dd><div className="fw-700">{vendor?.name}</div><div className="text-xs muted">SLA: {vendor?.sla} · {vendor?.contact}</div></dd>
          <dt>Equipo</dt>
          <dd>
            <div className="fw-700">{device?.model}</div>
            <div className="text-xs muted mono">{device?.serial}</div>
          </dd>
          <dt>Motivo</dt>
          <dd style={{whiteSpace:'pre-line', fontSize:13}}>{form.reason || <em className="muted">(vacío)</em>}</dd>
          <dt>Urgencia</dt>
          <dd><span className={`badge badge--${form.urgency==='critica'?'red':form.urgency==='alta'?'amber':form.urgency==='baja'?'gray':'blue'}`}>{form.urgency.toUpperCase()}</span></dd>
        </dl>
      </div>

      <Field label="Nº RMA del proveedor *"
             hint="El código que devuelve el proveedor al autorizar la devolución. Si no lo tienes aún, pon 'Pendiente' y edítalo después.">
        <input className="input mono" placeholder="Ej. DL-RMA-87423-ES"
               value={form.vendorRmaNumber}
               onChange={e => setForm({...form, vendorRmaNumber: e.target.value})} autoFocus />
      </Field>

      <Field label="Notas internas">
        <textarea className="textarea" placeholder="Tracking, persona de contacto en el proveedor, etc."
                  value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})} />
      </Field>

      {incident && (
        <div style={{padding:12, background:'var(--blue-50)', borderRadius:10, fontSize:12, color:'var(--blue-900)', display:'flex', gap:8}}>
          <Icon name="alert" size={14}/>
          <div>Al crear el RMA, la incidencia <strong>{incident.id}</strong> pasará automáticamente a estado <strong>"Esperando pieza"</strong> y se vinculará bidireccionalmente con este RMA.</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CASES SCREEN — unified incident↔RMA pipeline
// ═══════════════════════════════════════════════════════════════
const CASE_STAGES = [
  { id: 'open', label: 'Abierta', icon: 'ticket' },
  { id: 'diag', label: 'En curso', icon: 'edit' },
  { id: 'rma_req', label: 'RMA solicitado', icon: 'rma' },
  { id: 'rma_auth', label: 'Autorizado', icon: 'check' },
  { id: 'rma_ship', label: 'Enviado', icon: 'truck' },
  { id: 'rma_recv', label: 'Recibido', icon: 'package' },
  { id: 'rma_swap', label: 'Sustituido', icon: 'refresh' },
  { id: 'closed', label: 'Cerrada', icon: 'check' },
];

function getCaseStage(incident, rma) {
  if (incident.status === 'cerrada' || incident.status === 'resuelta') return 'closed';
  if (!rma) {
    if (incident.status === 'en_curso') return 'diag';
    return 'open';
  }
  // RMA exists
  if (rma.status === 'sustituido') return 'rma_swap';
  if (rma.status === 'cerrado') return 'closed';
  if (rma.status === 'recibido') return 'rma_recv';
  if (rma.status === 'enviado') return 'rma_ship';
  if (rma.status === 'autorizado') return 'rma_auth';
  if (rma.status === 'solicitado') return 'rma_req';
  return 'diag';
}

function CasesScreen({ state, setState, onOpenIncident, onOpenRma, onConvertIncident }) {
  const [scope, setScope] = cfState('all'); // all | with-rma | without-rma | active

  const cases = cfMemo(() => {
    // Build a "case" per incident
    let arr = state.incidents.map(inc => {
      const rma = inc.rmaId ? state.rmas.find(r => r.id === inc.rmaId) : null;
      return {
        incident: inc,
        rma,
        device: state.devices.find(d => d.id === inc.deviceId),
        tech: state.technicians.find(t => t.id === inc.assigneeId),
        vendor: rma ? state.vendors.find(v => v.id === rma.vendorId) : null,
        stage: getCaseStage(inc, rma),
      };
    });
    if (scope === 'with-rma') arr = arr.filter(c => c.rma);
    else if (scope === 'without-rma') arr = arr.filter(c => !c.rma);
    else if (scope === 'active') arr = arr.filter(c => c.stage !== 'closed');
    // Sort: active first, then by stage progress desc, then by update
    arr.sort((a, b) => {
      const aClosed = a.stage === 'closed';
      const bClosed = b.stage === 'closed';
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      const ai = CASE_STAGES.findIndex(s => s.id === a.stage);
      const bi = CASE_STAGES.findIndex(s => s.id === b.stage);
      if (ai !== bi) return bi - ai;
      return new Date(b.incident.updatedAt) - new Date(a.incident.updatedAt);
    });
    return arr;
  }, [state.incidents, state.rmas, state.devices, state.technicians, state.vendors, scope]);

  const counts = cfMemo(() => ({
    all: state.incidents.length,
    'with-rma': state.incidents.filter(i => i.rmaId).length,
    'without-rma': state.incidents.filter(i => !i.rmaId).length,
    active: state.incidents.filter(i => !['cerrada','resuelta'].includes(i.status)).length,
  }), [state.incidents]);

  return (
    <div className="stack">
      <div className="filterbar">
        <button className={`chip ${scope==='active'?'is-active':''}`} onClick={() => setScope('active')}>
          Activos <span className="chip__count">{counts.active}</span>
        </button>
        <button className={`chip ${scope==='with-rma'?'is-active':''}`} onClick={() => setScope('with-rma')}>
          Con RMA <span className="chip__count">{counts['with-rma']}</span>
        </button>
        <button className={`chip ${scope==='without-rma'?'is-active':''}`} onClick={() => setScope('without-rma')}>
          Sin RMA <span className="chip__count">{counts['without-rma']}</span>
        </button>
        <button className={`chip ${scope==='all'?'is-active':''}`} onClick={() => setScope('all')}>
          Todos <span className="chip__count">{counts.all}</span>
        </button>
        <div style={{flex:1}}/>
        <div className="muted text-xs">Vista unificada del flujo incidencia → RMA → cierre</div>
      </div>

      {!cases.length ? (
        <EmptyState icon="rma" title="No hay casos" subtitle="Ajusta el filtro o crea una nueva incidencia." />
      ) : (
        <div className="stack" style={{gap:12}}>
          {cases.map(c => (
            <CaseCard key={c.incident.id} caseData={c}
                      onOpenIncident={onOpenIncident}
                      onOpenRma={onOpenRma}
                      onConvertIncident={onConvertIncident} />
          ))}
        </div>
      )}
    </div>
  );
}

function CaseCard({ caseData, onOpenIncident, onOpenRma, onConvertIncident }) {
  const { incident, rma, device, tech, vendor, stage } = caseData;
  const stageIdx = CASE_STAGES.findIndex(s => s.id === stage);
  const isClosed = stage === 'closed';

  return (
    <div className="card" style={{padding:18}}>
      <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:16, alignItems:'flex-start'}}>
        {/* Left — incident + device summary */}
        <div style={{display:'flex', alignItems:'flex-start', gap:14, minWidth:0}}>
          <div style={{
            width:40, height:40, borderRadius:10,
            background: isClosed ? 'var(--gray-100)' : rma ? 'var(--orange-50)' : 'var(--blue-50)',
            color: isClosed ? 'var(--gray-500)' : rma ? 'var(--primary)' : 'var(--blue-500)',
            display:'grid', placeItems:'center', flexShrink:0,
          }}>
            <Icon name={rma ? 'rma' : 'ticket'} size={18} />
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
              <span className="id-cell fw-700">{incident.id}</span>
              <span className="muted">·</span>
              <PriorityPill priority={incident.priority} />
              {rma && (
                <button className="badge badge--purple" style={{border:0, cursor:'pointer'}}
                        onClick={(e) => { e.stopPropagation(); onOpenRma(rma.id); }}>
                  <Icon name="rma" size={10}/> {rma.id}
                </button>
              )}
            </div>
            <div className="fw-700" style={{fontSize:14, marginBottom:4, lineHeight:1.35, cursor:'pointer'}}
                 onClick={() => onOpenIncident(incident.id)}>
              {incident.title}
            </div>
            <div style={{display:'flex', alignItems:'center', gap:12, fontSize:12, color:'var(--fg-secondary)', flexWrap:'wrap'}}>
              {device && (
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <DeviceIcon type={device.type} size={12}/> {device.model}
                </span>
              )}
              {vendor && (
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <Icon name="vendors" size={12}/> {vendor.name}
                </span>
              )}
              {tech && (
                <span style={{display:'flex', alignItems:'center', gap:4}}>
                  <Avatar name={tech.name} initials={tech.initials} size="sm" />
                  {tech.name.split(' ')[0]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right — actions */}
        <div style={{display:'flex', alignItems:'flex-start', gap:8, flexShrink:0}}>
          {!rma && !isClosed && device && (
            <button className="btn btn--outline btn--sm" onClick={() => onConvertIncident(incident)}>
              <Icon name="rma" size={12}/> Crear RMA
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={() => onOpenIncident(incident.id)}>
            Ver <Icon name="arrowRight" size={12}/>
          </button>
        </div>
      </div>

      {/* Pipeline stepper */}
      <div style={{marginTop:18, paddingTop:18, borderTop:'1px solid var(--border-light)'}}>
        <PipelineStepper stageIdx={stageIdx} incident={incident} rma={rma} />
      </div>

      {/* Banner if RMA done */}
      {rma && (rma.status === 'sustituido' || rma.status === 'recibido') && !isClosed && (
        <div style={{
          marginTop:12, padding:'10px 12px',
          background:'var(--green-50)', border:'1px solid var(--green-500)',
          borderRadius:10, display:'flex', alignItems:'center', gap:10, fontSize:12,
        }}>
          <Icon name="check" size={14} color="var(--green-500)"/>
          <div style={{flex:1, color:'var(--green-900)'}}>
            <strong>RMA {rma.status === 'sustituido' ? 'completado' : 'recibido'}.</strong> Listo para cerrar la incidencia.
          </div>
          <button className="btn btn--primary btn--xs" onClick={() => onOpenIncident(incident.id)}>
            Cerrar incidencia
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline horizontal stepper ─────────────────────────────────
function PipelineStepper({ stageIdx, incident, rma }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:0, overflowX:'auto'}}>
      {CASE_STAGES.map((s, i) => {
        const done = i < stageIdx;
        const active = i === stageIdx;
        const future = i > stageIdx;
        let color = 'var(--gray-200)';
        let textColor = 'var(--gray-500)';
        if (done) { color = 'var(--primary)'; textColor = 'var(--gray-700)'; }
        if (active) {
          color = 'var(--primary)';
          textColor = 'var(--fg-primary)';
        }
        return (
          <React.Fragment key={s.id}>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6, flex:'0 0 auto', minWidth:80}}>
              <div style={{
                width: active ? 28 : 22,
                height: active ? 28 : 22,
                borderRadius: 50,
                background: future ? '#fff' : color,
                border: future ? '2px solid var(--gray-200)' : `2px solid ${color}`,
                color: future ? 'var(--gray-400)' : '#fff',
                display:'grid', placeItems:'center',
                transition:'all 0.2s',
                boxShadow: active ? '0 0 0 4px var(--orange-50)' : 'none',
              }}>
                {done ? <Icon name="check" size={12}/> : active ? <Icon name={s.icon} size={12}/> : <Icon name={s.icon} size={11}/>}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: textColor, textAlign:'center',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.2,
                whiteSpace:'nowrap',
              }}>{s.label}</span>
            </div>
            {i < CASE_STAGES.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 12,
                background: i < stageIdx ? 'var(--primary)' : 'var(--gray-200)',
                marginTop: -16,
                borderRadius: 1,
                transition: 'background 0.3s',
              }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

Object.assign(window, { RmaWizard, CasesScreen, REASON_TEMPLATES });
