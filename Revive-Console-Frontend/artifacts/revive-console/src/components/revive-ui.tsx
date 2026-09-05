import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Activity, ArrowUpRight, Blocks, Bot, CheckCircle2,
  ChevronRight, CircleAlert, CircleDashed, ClipboardList, Code2,
  CreditCard, Database, FileUp, Gauge, Headphones, LayoutDashboard, LifeBuoy,
  Menu, MessageCircle, Network, Phone, Play, Plus, Radar, RefreshCw, Search,
  Send, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Upload, X, Zap,
} from 'lucide-react';
import { apiConnectionLabel } from '@/services/api';

const navGroups = [
  {
    label: 'Monitor',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/payments', label: 'Payments', icon: CreditCard },
      { href: '/recovery', label: 'Recovery', icon: Radar },
      { href: '/promises', label: 'Promises', icon: CheckCircle2 },
      { href: '/communication', label: 'Communication', icon: MessageCircle },
    ],
  },
  {
    label: 'Operate',
    items: [
      { href: '/roi', label: 'ROI', icon: Gauge },
      { href: '/simulation', label: 'Simulation', icon: Blocks },
      { href: '/voice', label: 'Voice', icon: Phone },
      { href: '/whatsapp', label: 'WhatsApp / Twilio', icon: Send },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/recovery-config', label: 'Recovery config', icon: SlidersHorizontal },
    ],
  },
];

function Brand() {
  return (
    <Link href="/" className="brand" data-testid="link-brand">
      <span className="brand-mark">R</span>
      <span><strong>REVIVE</strong><small>PAYMENT RECOVERY</small></span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-frame">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head"><Brand /><button className="icon-button mobile-menu" onClick={() => setOpen(false)} data-testid="button-close-menu"><X size={17} /></button></div>
        <div className="workspace-switcher">
          <span className="workspace-dot"><ShieldCheck size={13} /></span>
          <span><b>Revive console</b><small>Contract-aware workspace</small></span>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const active = item.href === '/' ? location === '/' : location.startsWith(item.href);
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`nav-item ${active ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
                  <Icon size={16} strokeWidth={active ? 2.25 : 1.8} /><span>{item.label}</span>
                </Link>;
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="queue-card"><div className="queue-kicker"><span className="status-dot" /> Contract status</div><strong>Safe observation mode.</strong><p>Requests stay paused until backend contracts are available.</p></div>
          <div className="side-foot-links"><span className="mono">NO REQUEST SENT</span></div>
        </div>
      </aside>
      {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" data-testid="button-dismiss-menu" />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setOpen(true)} data-testid="button-open-menu"><Menu size={18} /></button>
          <div className="crumbs"><span className="crumb-muted">OPERATIONS</span><ChevronRight size={14} /><span>{location === '/' ? 'Overview' : location.slice(1).replaceAll('-', ' ')}</span></div>
          <div className="top-actions">
            <div className="engine-pill"><span className="status-dot" /> {apiConnectionLabel()}</div>
            <div className="profile"><span className="avatar">R</span><span className="mobile-hide">Revive</span></div>
          </div>
        </header>
        <div className="page-wrap">{children}</div>
      </main>
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: ReactNode; description: string; action?: ReactNode }) {
  return <div className="page-intro animate-rise"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="intro-action">{action}</div>}</div>;
}

export function PrimaryButton({ children, onClick, icon, testId }: { children: ReactNode; onClick?: () => void; icon?: ReactNode; testId: string }) {
  return <button className="button button-primary" onClick={onClick} data-testid={testId}>{icon}{children}<ArrowUpRight size={14} /></button>;
}

export function SecondaryButton({ children, onClick, icon, testId }: { children: ReactNode; onClick?: () => void; icon?: ReactNode; testId: string }) {
  return <button className="button button-secondary" onClick={onClick} data-testid={testId}>{icon}{children}</button>;
}

export function ContractNotice({ title = 'Awaiting backend contract', detail = 'This surface is ready for a real request and response contract. No fields or records are being inferred.' }: { title?: string; detail?: string }) {
  return <div className="contract-notice" data-testid="status-awaiting-contract"><div className="notice-icon"><CircleDashed size={19} /></div><div><strong>{title}</strong><p>{detail}</p><span className="mono">SAFE STATE · NO REQUEST SENT</span></div></div>;
}

export function EmptyState({ title, description, icon = <Database size={20} />, action }: { title: string; description: string; icon?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state" data-testid="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function ActionWorkbench({ title, description, actions }: { title: string; description: string; actions: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <section className="workbench card animate-rise"><div className="section-head"><div><span className="section-index">01</span><div><h2>{title}</h2><p>{description}</p></div></div><span className="contract-chip"><ShieldCheck size={14} /> contract-gated</span></div><div className="action-grid">
    {actions.map((action, index) => <button key={action} className={`action-tile ${selected === action ? 'selected' : ''}`} onClick={() => setSelected(action)} data-testid={`button-action-${action.toLowerCase().replaceAll(' ', '-')}`}><span className="action-number">0{index + 1}</span><span className="action-icon">{index === 0 ? <Play size={16} /> : index === 1 ? <RefreshCw size={16} /> : <Sparkles size={16} />}</span><strong>{action}</strong><ChevronRight size={15} /></button>)}
  </div>{selected && <div className="action-feedback" data-testid="status-action-feedback"><CircleAlert size={17} /><div><strong>{selected} is ready for wiring</strong><p>The request body and response shape are not available yet, so Revive has not sent anything.</p></div><button className="icon-button" onClick={() => setSelected(null)} data-testid="button-dismiss-action"><X size={16} /></button></div>}<ContractNotice /></section>;
}

export function SearchBar({ placeholder, testId }: { placeholder: string; testId: string }) {
  return <div className="search-bar"><Search size={16} /><input placeholder={placeholder} data-testid={testId} aria-label={placeholder} /><span className="mono">⌘ K</span></div>;
}

export function DataTableShell({ title, description, columns }: { title: string; description: string; columns: string[] }) {
  return <section className="table-card card animate-rise"><div className="table-toolbar"><div><h2>{title}</h2><p>{description}</p></div><button className="icon-button" data-testid="button-table-options"><Settings2 size={16} /></button></div><div className="table-search"><SearchBar placeholder={`Search ${title.toLowerCase()}`} testId={`input-search-${title.toLowerCase().replaceAll(' ', '-')}`} /></div><div className="table-empty"><div className="empty-orbit"><CircleDashed size={22} /></div><strong>No records to display</strong><span>The API returned no records, or its list contract is not available.</span></div><div className="table-columns">{columns.map((column) => <span key={column}>{column}</span>)}</div></section>;
}

export function MetricCard({ label, value, detail, tone = 'neutral', icon }: { label: string; value: string; detail: string; tone?: string; icon: ReactNode }) {
  return <div className={`metric-card ${tone}`} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{detail}</small></div>;
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`status-pill ${tone}`}>{children}</span>; }

export function MiniSparkline({ color = 'var(--green)' }: { color?: string }) { return <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 24 C 12 22, 14 15, 25 19 S 42 6, 53 14 S 67 16, 76 8 S 90 12, 100 3" fill="none" stroke={color} strokeWidth="2" /></svg>; }

export function IntegrationRow({ name, icon, state = 'Not connected', action = 'Configure' }: { name: string; icon: ReactNode; state?: string; action?: string }) {
  return <div className="integration-row" data-testid={`row-integration-${name.toLowerCase().replaceAll(' ', '-')}`}><span className="integration-icon">{icon}</span><div><strong>{name}</strong><small>{state}</small></div><span className="mono">CONTRACT NEEDED</span></div>;
}