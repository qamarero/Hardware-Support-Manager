// ═══════════════════════════════════════════════════════════════
// Shared UI components — Hardware Support Manager
// Loaded BEFORE the screen scripts. Exposes to window scope.
// ═══════════════════════════════════════════════════════════════

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Icon system (inline SVG, lucide-style 2px stroke) ─────────
const Icon = ({ name, size = 16, color = 'currentColor', strokeWidth = 2 }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
    ticket: <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></>,
    kanban: <><path d="M5 3v18"/><path d="M19 3v18"/><path d="M12 3v18"/><path d="M5 9h7"/><path d="M5 15h7"/><path d="M12 7h7"/></>,
    rma: <><path d="m16 16 3 3 3-3"/><path d="M19 13v6"/><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3"/><path d="M3 11v8a2 2 0 0 0 2 2h7"/><path d="M3 11h18"/></>,
    inventory: <><path d="M20 7l-8-4-8 4"/><path d="M20 7v10l-8 4-8-4V7"/><path d="m4 7 8 4 8-4"/><path d="M12 11v10"/></>,
    vendors: <><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 9h.01"/><path d="M9 13h.01"/><path d="M9 17h.01"/><path d="M15 9h.01"/><path d="M15 13h.01"/><path d="M15 17h.01"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
    close: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    chevronRight: <><path d="m9 18 6-6-6-6"/></>,
    chevronLeft: <><path d="m15 18-6-6 6-6"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    paperclip: <><path d="m21 8.5-9.5 9.5a5 5 0 0 1-7-7L13.5 2A3.5 3.5 0 0 1 19 7L9.5 16.5a2 2 0 0 1-2.8-2.8L15 5.5"/></>,
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    alert: <><path d="m21.7 16.2-9-15.4a2 2 0 0 0-3.4 0l-9 15.4A2 2 0 0 0 2 19h18a2 2 0 0 0 1.7-2.8Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    laptop: <><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.3 2.6a1 1 0 0 1-.9 1.4H3.6a1 1 0 0 1-.9-1.4L4 16"/></>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    printer: <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
    smartphone: <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>,
    headphones: <><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-9a9 9 0 0 1 18 0v9a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></>,
    mouse: <><rect x="6" y="3" width="12" height="18" rx="6"/><line x1="12" y1="7" x2="12" y2="11"/></>,
    settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    arrowRight: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    package: <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    truck: <><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
    sparkles: <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></>,
    moreHorizontal: <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    tablet: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>,
  };
  const p = paths[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      {p}
    </svg>
  );
};

// ── Logo mark ─────────────────────────────────────────────────
const LogoMark = ({ size = 28 }) => (
  <div style={{
    width: size, height: size,
    background: 'var(--primary)',
    borderRadius: 8,
    display: 'grid', placeItems: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: size * 0.5,
    letterSpacing: '-0.02em',
  }}>H</div>
);

// ── Status badge ──────────────────────────────────────────────
const StatusBadge = ({ status, type = 'incident' }) => {
  const labels = type === 'incident' ? window.HSM_DATA.STATUS_LABEL : window.HSM_DATA.RMA_STATUS_LABEL;
  const colors = type === 'incident' ? window.HSM_DATA.STATUS_BADGE : window.HSM_DATA.RMA_STATUS_BADGE;
  return <span className={`badge badge--dot badge--${colors[status] || 'gray'}`}>{labels[status] || status}</span>;
};

// ── Priority pill ─────────────────────────────────────────────
const PriorityPill = ({ priority }) => (
  <span className={`priority priority--${priority}`}>
    <span className="priority__dot"></span>
    {window.HSM_DATA.PRIORITY_LABEL[priority]}
  </span>
);

// ── Avatar ────────────────────────────────────────────────────
const Avatar = ({ name, initials, size }) => {
  const display = initials || (name ? name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() : '?');
  // Stable hue from name
  let hash = 0;
  for (const c of (name || display)) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffff;
  const hues = ['var(--orange-400)','var(--orange-500)','var(--purple-500)','var(--blue-500)','var(--green-500)','var(--amber-500)','var(--gray-700)'];
  const bg = hues[Math.abs(hash) % hues.length];
  return (
    <div className={`avatar${size === 'sm' ? ' avatar--sm' : size === 'lg' ? ' avatar--lg' : ''}`}
         style={{ background: bg }} title={name}>
      {display}
    </div>
  );
};

// ── Device icon by type ───────────────────────────────────────
const DeviceIcon = ({ type, size = 16 }) => {
  const map = {
    'Portátil': 'laptop',
    'Sobremesa': 'monitor',
    'Monitor': 'monitor',
    'Impresora': 'printer',
    'Tablet': 'tablet',
    'Periférico': 'mouse',
    'Auricular': 'headphones',
  };
  return <Icon name={map[type] || 'package'} size={size} />;
};

// ── SLA bar ───────────────────────────────────────────────────
const SlaBar = ({ incident }) => {
  const { pct, level, isClosed, isPaused } = window.HSM_UTIL.slaProgress(incident);
  if (isClosed) return <span className="badge badge--gray">cumplido</span>;
  if (isPaused) {
    return (
      <div className="flex items-center gap-2">
        <div className="sla-bar sla-bar--paused">
          <div className="sla-bar__fill sla-bar__fill--paused" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className="sla-text sla-text--paused">
          <Icon name="clock" size={10} /> Pausado
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="sla-bar">
        <div className={`sla-bar__fill sla-bar__fill--${level}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="sla-text">{window.HSM_UTIL.slaText(incident)}</span>
    </div>
  );
};

// ── Card wrapper ──────────────────────────────────────────────
const Card = ({ children, title, subtitle, action, padding = true, className = '' }) => (
  <div className={`card ${className}`}>
    {(title || action) && (
      <div className="card__header">
        <div>
          {title && <h3>{title}</h3>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    <div style={{ padding: padding ? 24 : 0 }}>
      {children}
    </div>
  </div>
);

// ── Modal / Drawer ─────────────────────────────────────────────
const Drawer = ({ open, onClose, title, subtitle, children, footer, width }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={width ? { width } : undefined}>
        <div className="drawer__header">
          <div className="flex-1">
            <h2 className="drawer__title">{title}</h2>
            {subtitle && <p className="drawer__subtitle">{subtitle}</p>}
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__footer">{footer}</div>}
      </div>
    </>
  );
};

// ── Toast ─────────────────────────────────────────────────────
function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);
  // Expose
  useEffect(() => {
    window.HSM_TOAST = showToast;
  }, [showToast]);
  return (
    <>
      {children}
      {toast && (
        <div className="toast">
          <Icon name="check" size={16} color="var(--success)" />
          {toast}
        </div>
      )}
    </>
  );
}

// ── Field + Input ─────────────────────────────────────────────
const Field = ({ label, hint, children }) => (
  <div className="field">
    {label && <label className="field__label">{label}</label>}
    {children}
    {hint && <span className="field__hint">{hint}</span>}
  </div>
);

// Expose globals
Object.assign(window, {
  Icon, LogoMark, StatusBadge, PriorityPill, Avatar, DeviceIcon,
  SlaBar, Card, Drawer, ToastProvider, Field,
  ReactHooks: { useState, useEffect, useRef, useMemo, useCallback },
});
