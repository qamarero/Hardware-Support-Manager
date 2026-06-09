// ═══════════════════════════════════════════════════════════════
// Hardware Support Manager — root app
// ═══════════════════════════════════════════════════════════════
const { useState: appState, useEffect: appEffect, useMemo: appMemo } = React;

// Tweaks defaults — toggled via panel
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dashboardVariant": "classic",
  "listVariant": "table",
  "density": "comfortable"
}/*EDITMODE-END*/;

function App() {
  const [state, _setState] = appState(() => window.HSM_STORAGE.loadState());
  const [route, setRoute] = appState('dashboard'); // dashboard | incidents | kanban | rma | inventory | vendors
  const [openIncidentId, setOpenIncidentId] = appState(null);
  const [openRmaId, setOpenRmaId] = appState(null);
  const [formOpen, setFormOpen] = appState(false);
  const [rmaFormFor, setRmaFormFor] = appState(null); // incident object or true (blank)
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // Persist on every change
  const setState = (next) => {
    _setState(next);
    window.HSM_STORAGE.saveState(next);
  };

  // Counts for nav
  const navCounts = appMemo(() => {
    const openIncidents = state.incidents.filter(i => !['resuelta','cerrada'].includes(i.status)).length;
    const openRmas = state.rmas.filter(r => r.status !== 'cerrado').length;
    return { incidents: openIncidents, rma: openRmas };
  }, [state.incidents, state.rmas]);

  const openIncident = (id) => setOpenIncidentId(id);
  const closeIncident = () => setOpenIncidentId(null);
  const openRma = (id) => setOpenRmaId(id);
  const closeRma = () => setOpenRmaId(null);
  const goCreate = () => setFormOpen(true);
  const closeForm = (createdId) => {
    setFormOpen(false);
    if (createdId) setOpenIncidentId(createdId);
  };
  const startRmaFromIncident = (incident) => {
    setOpenIncidentId(null);
    setRmaFormFor(incident);
  };
  const closeRmaForm = (createdId) => {
    setRmaFormFor(null);
    if (createdId) setOpenRmaId(createdId);
  };

  // Topbar context
  const titles = {
    dashboard: { h: 'Panel', p: 'Vista general del departamento de hardware' },
    incidents: { h: 'Incidencias', p: 'Tickets de soporte hardware' },
    kanban: { h: 'Tablero Kanban', p: 'Arrastra y suelta para cambiar de estado' },
    corkboard: { h: 'Corcho', p: 'Vista rápida de incidencias para el día' },
    cases: { h: 'Casos · RMA', p: 'Pipeline unificado incidencia → RMA → cierre' },
    rma: { h: 'RMA', p: 'Devoluciones a proveedor / fabricante' },
    inventory: { h: 'Inventario', p: 'Equipos y dispositivos' },
    vendors: { h: 'Proveedores', p: 'Fabricantes y soporte' },
  };
  const ctx = titles[route];

  const onResetData = () => {
    if (!confirm('¿Restaurar datos de ejemplo? Se perderán los cambios locales.')) return;
    const fresh = window.HSM_STORAGE.resetState();
    _setState(fresh);
    window.HSM_TOAST?.('Datos restaurados');
  };

  const currentUser = state.technicians.find(u => u.id === state.currentUserId);

  return (
    <ToastProvider>
      <div className="app">
        {/* ─── SIDEBAR ─── */}
        <aside className="sidebar">
          <div className="sidebar__brand">
            <LogoMark size={32} />
            <div className="sidebar__brand-text">
              <div className="sidebar__brand-name">Hardware Support</div>
              <div className="sidebar__brand-sub">Manager</div>
            </div>
          </div>

          <div className="sidebar__section">Operaciones</div>
          <button className={`nav-item ${route==='dashboard'?'is-active':''}`} onClick={() => setRoute('dashboard')}>
            <Icon name="dashboard" size={16}/> Panel
          </button>
          <button className={`nav-item ${route==='incidents'?'is-active':''}`} onClick={() => setRoute('incidents')}>
            <Icon name="ticket" size={16}/> Incidencias
            {navCounts.incidents > 0 && <span className="nav-item__count">{navCounts.incidents}</span>}
          </button>
          <button className={`nav-item ${route==='kanban'?'is-active':''}`} onClick={() => setRoute('kanban')}>
            <Icon name="kanban" size={16}/> Tablero Kanban
          </button>
          <button className={`nav-item ${route==='corkboard'?'is-active':''}`} onClick={() => setRoute('corkboard')}>
            <Icon name="ticket" size={16}/> Corcho
          </button>
          <button className={`nav-item ${route==='cases'?'is-active':''}`} onClick={() => setRoute('cases')}>
            <Icon name="refresh" size={16}/> Casos · RMA
            {navCounts.rma > 0 && <span className="nav-item__count">{navCounts.rma}</span>}
          </button>
          <button className={`nav-item ${route==='rma'?'is-active':''}`} onClick={() => setRoute('rma')}>
            <Icon name="rma" size={16}/> RMA
          </button>

          <div className="sidebar__section">Catálogo</div>
          <button className={`nav-item ${route==='inventory'?'is-active':''}`} onClick={() => setRoute('inventory')}>
            <Icon name="inventory" size={16}/> Inventario
          </button>
          <button className={`nav-item ${route==='vendors'?'is-active':''}`} onClick={() => setRoute('vendors')}>
            <Icon name="vendors" size={16}/> Proveedores
          </button>

          <div className="sidebar__user">
            {currentUser && <>
              <Avatar name={currentUser.name} initials={currentUser.initials} />
              <div className="sidebar__user-info">
                <div className="sidebar__user-name">{currentUser.name}</div>
                <div className="sidebar__user-role">{currentUser.role}</div>
              </div>
            </>}
          </div>
        </aside>

        {/* ─── MAIN ─── */}
        <div className="main">
          <div className="topbar">
            <div className="topbar__title">
              <h1>{ctx.h}</h1>
              <p>{ctx.p}</p>
            </div>
            <div className="search">
              <Icon name="search" size={14}/>
              <input placeholder="Buscar global…" />
            </div>
            <button className="btn btn--ghost btn--icon" onClick={onResetData} title="Restaurar datos de ejemplo">
              <Icon name="refresh" size={16} />
            </button>
            <button className="btn btn--ghost btn--icon" title="Notificaciones">
              <Icon name="bell" size={16}/>
            </button>
            {route === 'incidents' || route === 'kanban' ? (
              <button className="btn btn--primary btn--sm" onClick={goCreate}>
                <Icon name="plus" size={14}/> Nueva incidencia
              </button>
            ) : route === 'rma' ? (
              <button className="btn btn--primary btn--sm" onClick={() => setRmaFormFor(true)}>
                <Icon name="plus" size={14}/> Nuevo RMA
              </button>
            ) : (
              <button className="btn btn--primary btn--sm" onClick={goCreate}>
                <Icon name="plus" size={14}/> Nueva incidencia
              </button>
            )}
          </div>

          <div className="page">
            {route === 'dashboard' && (
              <Dashboard state={state} variant={tweaks.dashboardVariant}
                         onNav={r => setRoute(r === 'incidents-new' ? (goCreate(), 'incidents') : r)}
                         onOpenIncident={openIncident} />
            )}
            {route === 'incidents' && (
              <IncidentsScreen state={state} setState={setState}
                               listVariant={tweaks.listVariant}
                               onOpenIncident={openIncident}
                               onCreate={goCreate} />
            )}
            {route === 'kanban' && (
              <KanbanScreen state={state} setState={setState}
                            onOpenIncident={openIncident}
                            onCreate={goCreate} />
            )}
            {route === 'corkboard' && (
              <CorkboardScreen state={state} setState={setState}
                               onOpenIncident={openIncident}
                               onCreate={goCreate} />
            )}
            {route === 'cases' && (
              <CasesScreen state={state} setState={setState}
                           onOpenIncident={openIncident}
                           onOpenRma={openRma}
                           onConvertIncident={startRmaFromIncident} />
            )}
            {route === 'rma' && (
              <RmaScreen state={state} setState={setState}
                         onOpenRma={openRma}
                         onCreateRma={() => setRmaFormFor(true)} />
            )}
            {route === 'inventory' && (
              <InventoryScreen state={state} onOpenIncident={openIncident} />
            )}
            {route === 'vendors' && (
              <VendorsScreen state={state} />
            )}
          </div>
        </div>

        {/* ─── Drawers / modals ─── */}
        {openIncidentId && (
          <IncidentDetail incidentId={openIncidentId} state={state} setState={setState}
                          onClose={closeIncident}
                          onConvertRma={startRmaFromIncident}
                          onOpenRma={(rid) => { closeIncident(); setOpenRmaId(rid); }} />
        )}
        {openRmaId && (
          <RmaDetail rmaId={openRmaId} state={state} setState={setState}
                     onClose={closeRma}
                     onOpenIncident={(iid) => { setOpenRmaId(null); openIncident(iid); }} />
        )}
        <IncidentForm open={formOpen} state={state} setState={setState} onClose={closeForm} />
        <RmaWizard open={!!rmaFormFor} state={state} setState={setState}
                   incident={typeof rmaFormFor === 'object' ? rmaFormFor : null}
                   onClose={closeRmaForm} />

        {/* ─── Tweaks panel ─── */}
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Vistas">
            <window.TweakSelect label="Estilo del Panel"
              value={tweaks.dashboardVariant}
              options={[
                {value:'classic', label:'Clásico'},
                {value:'bento', label:'Bento'},
                {value:'focus', label:'Focus'},
              ]}
              onChange={(v) => setTweak('dashboardVariant', v)} />
            <window.TweakSelect label="Listado de incidencias"
              value={tweaks.listVariant}
              options={[
                {value:'table', label:'Tabla densa'},
                {value:'cards', label:'Tarjetas'},
                {value:'grouped', label:'Por prioridad'},
              ]}
              onChange={(v) => setTweak('listVariant', v)} />
          </window.TweakSection>
          <window.TweakSection label="Datos">
            <window.TweakButton label="Restaurar datos de ejemplo" onClick={onResetData} />
          </window.TweakSection>
        </window.TweaksPanel>
      </div>
    </ToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
