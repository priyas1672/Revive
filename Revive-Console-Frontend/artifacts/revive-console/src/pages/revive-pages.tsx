import { useState ,  useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, ArrowUpRight, Blocks, Bot, CheckCircle2, Code2, CreditCard, FileUp, Headphones, MessageCircle, Network, Phone, Play, Plus, Send, Upload, Zap } from 'lucide-react';
import { ActionWorkbench, ContractNotice, DataTableShell, EmptyState, IntegrationRow, MetricCard, MiniSparkline, PageIntro, PrimaryButton, SearchBar, SecondaryButton, StatusPill } from '@/components/revive-ui';

import { apiRequest, setAuthToken, ApiRequestError } from '@/services/api';


export function OverviewPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ success: boolean; dashboard: any }>('/api/roi/dashboard')
      .then((result) => setDashboard(result.dashboard))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : 'Could not load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const formatMoney = (value: number | undefined) =>
    value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`;

  return <><PageIntro eyebrow="Recovery operations · today" title={<>Know what needs a hand.<br /><em>Move with evidence.</em></>} description="A focused command surface for payment recovery." action={<StatusPill tone={error ? 'coral' : 'green'}>{error ? 'CONNECTION ERROR' : 'LIVE'}</StatusPill>} />

    {error && <div className="signal-banner"><div className="signal-pulse"><Activity size={17} /></div><div><strong>Could not load dashboard</strong><span>{error}</span></div></div>}

    <div className="metrics-grid">
      <MetricCard label="Recovered" value={loading ? '…' : formatMoney(dashboard?.recovery?.recoveredAmount)} detail={`${dashboard?.recovery?.recoveredCases ?? 0} cases`} tone="green" icon={<CheckCircle2 size={17} />} />
      <MetricCard label="Outstanding" value={loading ? '…' : formatMoney(dashboard?.recovery?.outstandingAmount)} detail="Still at risk" tone="coral" icon={<Zap size={17} />} />
      <MetricCard label="Promises" value={loading ? '…' : String(dashboard?.recovery?.promisedCases ?? 0)} detail="Promise-to-pay cases" icon={<MessageCircle size={17} />} />
      <MetricCard label="Total Payments" value={loading ? '…' : String(dashboard?.payments?.total ?? 0)} detail={`${dashboard?.payments?.failed ?? 0} failed`} icon={<CreditCard size={17} />} />
    </div>

    <div className="overview-grid">
      <section className="chart-card card">
        <div className="section-head"><div><span className="section-index">02</span><div><h2>Recovery rate</h2><p>Recovered vs total cases</p></div></div><StatusPill>{loading ? 'LOADING' : 'LIVE'}</StatusPill></div>
        <div className="chart-empty">
          {loading ? <EmptyState title="Loading…" description="Fetching your recovery data." /> :
            <EmptyState title={`${dashboard?.recovery?.recoveryRate ?? 0}% recovery rate`} description={`${dashboard?.recovery?.recoveredCases ?? 0} of ${dashboard?.recovery?.totalCases ?? 0} cases recovered so far.`} />}
        </div>
      </section>
      <section className="flow-card card">
        <div className="section-head"><div><span className="section-index">03</span><div><h2>Case breakdown</h2><p>Where cases currently stand</p></div></div><Bot size={18} /></div>
        <div className="flow-line">
          <div className="flow-node"><span>Open</span><strong>{dashboard?.recovery?.openCases ?? 0}</strong></div>
          <div className="flow-connector" />
          <div className="flow-node"><span>In progress</span><strong>{dashboard?.recovery?.inProgressCases ?? 0}</strong></div>
          <div className="flow-connector" />
          <div className="flow-node"><span>Escalated</span><strong>{dashboard?.recovery?.escalatedCases ?? 0}</strong></div>
        </div>
      </section>
    </div>

    <section className="card quick-start">
      <div><span className="eyebrow">Next useful move</span><h2>Test a batch of failed payments.</h2><p>Run the simulation to see Revive's decisions on real-looking data.</p></div>
      <div className="quick-links"><Link href="/recovery" data-testid="link-quick-recovery"><RadarMark />Recovery actions <ArrowUpRight size={14} /></Link><Link href="/simulation" data-testid="link-quick-simulation"><FileUp size={15} />Test a batch <ArrowUpRight size={14} /></Link></div>
    </section>
  </>;
}

function RadarMark() { return <span className="inline-icon"><Activity size={15} /></span>; }



type FieldDef = { key: string; label: string; type?: 'text' | 'number' | 'date'; placeholder?: string; required?: boolean };
type ActionDef = { label: string; endpoint: string; fields: FieldDef[] };
type WorkbenchConfig = { eyebrow: string; title: string; description: string; actions: ActionDef[] };

const workbenchConfigs: Record<string, WorkbenchConfig> = {
  recovery: {
    eyebrow: 'Decision engine · 03 actions',
    title: 'Recovery actions',
    description: 'Evaluate a failed payment, retry with context, or prepare an offer.',
    actions: [
      {
        label: 'Evaluate',
        endpoint: '/api/recovery/evaluate',
        fields: [
          { key: 'failureCode', label: 'Failure code', placeholder: 'TIMEOUT / INSUFFICIENT_FUNDS', required: true },
          { key: 'failureReason', label: 'Failure reason', placeholder: 'network timeout', required: true },
          { key: 'retryCount', label: 'Retry count', type: 'number', placeholder: '0' },
        ],
      },
      {
        label: 'Retry',
        endpoint: '/api/recovery/retry',
        fields: [{ key: 'recoveryCaseId', label: 'Recovery Case ID', placeholder: 'Mongo ObjectId', required: true }],
      },
      {
        label: 'Offer',
        endpoint: '/api/recovery/offer',
        fields: [{ key: 'amount', label: 'Amount (₹)', type: 'number', placeholder: '2500', required: true }],
      },
    ],
  },
  promises: {
    eyebrow: 'Commitments · 03 actions',
    title: 'Promises',
    description: 'Receive, fulfill, or mark a promise broken.',
    actions: [
      {
        label: 'Receive',
        endpoint: '/api/promises/receive',
        fields: [
          { key: 'recoveryCaseId', label: 'Recovery Case ID', required: true },
          { key: 'promisedAmount', label: 'Promised amount (₹)', type: 'number', required: true },
          { key: 'promisedDate', label: 'Promised date', type: 'date', required: true },
        ],
      },
      {
        label: 'Fulfill',
        endpoint: '/api/promises/fulfill',
        fields: [{ key: 'recoveryCaseId', label: 'Recovery Case ID', required: true }],
      },
      {
        label: 'Broken',
        endpoint: '/api/promises/broken',
        fields: [{ key: 'recoveryCaseId', label: 'Recovery Case ID', required: true }],
      },
    ],
  },
  communication: {
    eyebrow: 'Channels · 02 actions',
    title: 'Communication',
    description: 'Send a recovery message or simulate an AI chat with a customer.',
    actions: [
      {
        label: 'Send',
        endpoint: '/api/communication/send',
        fields: [
          { key: 'recoveryCaseId', label: 'Recovery Case ID', required: true },
          { key: 'channel', label: 'Channel', placeholder: 'WHATSAPP' },
        ],
      },
      {
        label: 'Chat',
        endpoint: '/api/communication/chat',
        fields: [
          { key: 'recoveryCaseId', label: 'Recovery Case ID', required: true },
          { key: 'customerMessage', label: 'Customer message', placeholder: 'Kal pay kar dunga', required: true },
          { key: 'channel', label: 'Channel', placeholder: 'WHATSAPP' },
        ],
      },
    ],
  },
};

export function WorkbenchPage({ kind }: { kind: keyof typeof workbenchConfigs }) {
  const config = workbenchConfigs[kind];
  const [selectedAction, setSelectedAction] = useState(config.actions[0].label);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);

  const activeAction = config.actions.find((a) => a.label === selectedAction)!;

  const handleSelectAction = (label: string) => {
    setSelectedAction(label);
    setFormValues({});
    setResponse(null);
    setError(null);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    const body: Record<string, unknown> = {};
    for (const field of activeAction.fields) {
      const raw = formValues[field.key];
      if (raw === undefined || raw === '') continue;
      body[field.key] = field.type === 'number' ? Number(raw) : raw;
    }

    try {
      const result = await apiRequest<any>(activeAction.endpoint, { method: 'POST', body });
      setResponse(result);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return <>
    <PageIntro eyebrow={config.eyebrow} title={config.title} description={config.description} action={<StatusPill tone="green">CONNECTED</StatusPill>} />

    <section className="card" style={{ padding: 24 }}>
      <div className="segmented" style={{ marginBottom: 20 }}>
        {config.actions.map((action) => (
          <button key={action.label} type="button" className={selectedAction === action.label ? 'active' : ''} onClick={() => handleSelectAction(action.label)}>
            {action.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="auth-form" style={{ maxWidth: 480 }}>
        {activeAction.fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              type={field.type || 'text'}
              placeholder={field.placeholder}
              required={field.required}
              value={formValues[field.key] || ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            />
          </label>
        ))}
        <button className="button button-primary button-wide" type="submit" disabled={loading}>
          {loading ? 'Running…' : `Run ${activeAction.label}`}
        </button>
      </form>

      {error && <div className="auth-feedback error" style={{ marginTop: 16 }}>{error}</div>}

      {response && (
        <div className="card" style={{ marginTop: 20, padding: 16, background: '#f5f5f5' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </section>

    <section className="guidance-grid">
      <div className="guidance-card card"><Code2 size={18} /><h3>Where to get a Recovery Case ID</h3><p>Right now there's no case list yet — recovery cases only get created by the Razorpay webhook when a real payment fails. We'll wire that browsing view next.</p></div>
      <div className="guidance-card card"><Network size={18} /><h3>What happens next</h3><p>Responses appear directly below the form so you can confirm the backend acted as expected.</p></div>
    </section>
  </>;
}



export function PaymentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // --- NEW: payment history state ---
  const [payments, setPayments] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // --- NEW: fetch payment list from backend ---
  const loadPayments = async () => {
    setListLoading(true);
    try {
      const response = await apiRequest<any>('/api/payments');
      setPayments(response.payments || []);
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setListLoading(false);
    }
  };

  // --- NEW: load list once when page opens ---
  useEffect(() => {
    loadPayments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiRequest<any>('/api/payments/create-order', {
        method: 'POST',
        body: {
          amount: Number(amount),
          customerName,
          customerEmail: customerEmail || undefined,
          customerPhone: customerPhone || undefined,
        },
      });
      setResult(response);
      loadPayments(); // --- NEW: refresh list right after creating an order ---
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not create order.');
    } finally {
      setLoading(false);
    }
  };

  return <>
    <PageIntro
      eyebrow="Ledger · payment attempts"
      title="Payments"
      description="Create a Razorpay test-mode order and see how Revive tracks it."
      action={
        <SecondaryButton testId="button-create-order" icon={<Plus size={15} />} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'Create order'}
        </SecondaryButton>
      }
    />

    {showForm && (
      <section className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={handleSubmit} className="auth-form" style={{ maxWidth: 480 }}>
          <label><span>Amount (₹)</span><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500" required /></label>
          <label><span>Customer name</span><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Rahul Sharma" required /></label>
          <label><span>Customer email (optional)</span><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="rahul@example.com" /></label>
          <label><span>Customer phone (optional)</span><input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+919999999999" /></label>
          <button className="button button-primary button-wide" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create order'}
          </button>
        </form>

        {error && <div className="auth-feedback error" style={{ marginTop: 16 }}>{error}</div>}

        {result && (
          <div className="card" style={{ marginTop: 20, padding: 16, background: '#f5f5f5' }}>
            <p style={{ marginBottom: 8 }}><strong>Order created ✅</strong></p>
            <p style={{ marginBottom: 4 }}>Payment ID (Mongo): <code>{result.payment?._id}</code></p>
            <p style={{ marginBottom: 4 }}>Razorpay Order ID: <code>{result.order?.id}</code></p>
            <p>Status: <code>{result.payment?.status}</code></p>
          </div>
        )}
      </section>
    )}

    {/* --- NEW: payment history table, replaces the old static DataTableShell --- */}
    <section className="card" style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Payment attempts</h2>

      {listLoading ? (
        <p>Loading…</p>
      ) : payments.length === 0 ? (
        <p>No payments yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: 8 }}>Customer</th>
              <th style={{ padding: 8 }}>Amount</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Razorpay Order ID</th>
              <th style={{ padding: 8 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8 }}>{p.customerName}</td>
                <td style={{ padding: 8 }}>₹{p.amount}</td>
                <td style={{ padding: 8 }}>{p.status}</td>
                <td style={{ padding: 8 }}>{p.razorpayOrderId}</td>
                <td style={{ padding: 8 }}>{new Date(p.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  </>;
}



export function RoiPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ success: boolean; dashboard: any }>('/api/roi/dashboard')
      .then((result) => setDashboard(result.dashboard))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : 'Could not load ROI data.'))
      .finally(() => setLoading(false));
  }, []);

  const formatMoney = (value: number | undefined) =>
    value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`;

  return <>
    <PageIntro
      eyebrow="Economics · live data"
      title="ROI"
      description="Understand recovered value, cost to recover, and the outcomes your team can trust."
      action={<StatusPill tone={error ? 'coral' : 'green'}>{error ? 'CONNECTION ERROR' : 'LIVE'}</StatusPill>}
    />

    {error && (
      <div className="signal-banner">
        <div className="signal-pulse"><Activity size={17} /></div>
        <div><strong>Could not load ROI data</strong><span>{error}</span></div>
      </div>
    )}

    <div className="roi-hero card">
      <div className="roi-lock"><GaugeMark /></div>
      <div>
        <span className="eyebrow">Recovery economics</span>
        <h2>{loading ? 'Loading…' : `${dashboard?.recovery?.revenueRecoveryRate ?? 0}% of failed revenue recovered`}</h2>
        <p>
          {loading
            ? 'Fetching your recovery numbers.'
            : `₹${dashboard?.recovery?.outstandingAmount ?? 0} is still outstanding across ${dashboard?.recovery?.totalCases ?? 0} recovery cases.`}
        </p>
      </div>
      <Link href="/recovery-config" className="button button-secondary" data-testid="link-roi-config" style={{ position: 'relative', zIndex: 2 }}>

    

        Check configuration <ArrowUpRight size={14} />
      </Link>
    </div>

    <div className="metrics-grid roi-metrics">
      <MetricCard
        label="Recovered value"
        value={loading ? '…' : formatMoney(dashboard?.recovery?.recoveredAmount)}
        detail={`${dashboard?.recovery?.recoveredCases ?? 0} cases recovered`}
        tone="green"
        icon={<CheckCircle2 size={17} />}
      />
      <MetricCard
        label="Recovery rate"
        value={loading ? '…' : `${dashboard?.recovery?.recoveryRate ?? 0}%`}
        detail={`${dashboard?.recovery?.recoveredCases ?? 0} of ${dashboard?.recovery?.totalCases ?? 0} cases`}
        icon={<Activity size={17} />}
      />
      <MetricCard
        label="Outstanding"
        value={loading ? '…' : formatMoney(dashboard?.recovery?.outstandingAmount)}
        detail="Still at risk"
        tone="coral"
        icon={<CreditCard size={17} />}
      />
    </div>

    {!loading && !error && (
      <section className="card" style={{ padding: 20, marginTop: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Action breakdown</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{JSON.stringify(dashboard?.actions, null, 2)}</pre>
      </section>
    )}
  </>;
}
function GaugeMark() { return <GaugeIcon />; }
function GaugeIcon() { return <span className="gauge-mark"><Activity size={26} /></span>; }



export function ConfigPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<any>('/api/recovery-config');
      setConfig(response.config);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleChange = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await apiRequest<any>('/api/recovery-config', {
        method: 'PUT',
        body: {
          maxDiscountPercent: Number(config.maxDiscountPercent),
          maxDiscountAmount: Number(config.maxDiscountAmount),
          minAmountForNegotiation: Number(config.minAmountForNegotiation),
          negotiationEnabled: config.negotiationEnabled,
          allowDiscount: config.allowDiscount,
          allowPromiseToPay: config.allowPromiseToPay,
          allowEmi: config.allowEmi,
        },
      });
      setConfig(response.config);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save configuration.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <PageIntro
      eyebrow="System · GET / PUT"
      title="Recovery configuration"
      description="Inspect and update your merchant recovery settings."
      action={<SecondaryButton testId="button-refresh-config" icon={<Activity size={15} />} onClick={loadConfig}>Refresh</SecondaryButton>}
    />

    {error && <div className="auth-feedback error" style={{ marginBottom: 16 }}>{error}</div>}

    {loading ? (
      <p>Loading configuration…</p>
    ) : (
      <section className="config-layout">
        <div className="config-panel card" style={{ padding: 24 }}>
          <div className="section-head">
            <div><h2>Configuration surface</h2><p>These limits bound what Revive's negotiation engine can offer.</p></div>
            <StatusPill tone="green">{saved ? 'SAVED' : 'LIVE'}</StatusPill>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="auth-form" style={{ maxWidth: 480, marginTop: 20 }}>
            <label>
              <span>Max discount percent (%)</span>
              <input type="number" value={config?.maxDiscountPercent ?? ''} onChange={(e) => handleChange('maxDiscountPercent', e.target.value)} />
            </label>
            <label>
              <span>Max discount amount (₹)</span>
              <input type="number" value={config?.maxDiscountAmount ?? ''} onChange={(e) => handleChange('maxDiscountAmount', e.target.value)} />
            </label>
            <label>
              <span>Minimum amount for negotiation (₹)</span>
              <input type="number" value={config?.minAmountForNegotiation ?? ''} onChange={(e) => handleChange('minAmountForNegotiation', e.target.value)} />
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!config?.negotiationEnabled} onChange={(e) => handleChange('negotiationEnabled', e.target.checked)} />
              <span>Negotiation enabled</span>
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!config?.allowDiscount} onChange={(e) => handleChange('allowDiscount', e.target.checked)} />
              <span>Allow discount</span>
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!config?.allowPromiseToPay} onChange={(e) => handleChange('allowPromiseToPay', e.target.checked)} />
              <span>Allow promise-to-pay</span>
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!config?.allowEmi} onChange={(e) => handleChange('allowEmi', e.target.checked)} />
              <span>Allow EMI</span>
            </label>

            <button className="button button-primary" type="submit" disabled={saving} data-testid="button-save-config">
              {saving ? 'Saving…' : 'Save changes'}<ArrowUpRight size={14} />
            </button>
          </form>
        </div>

        <div className="contract-side">
          <div className="method-list card">
            <div><span className="method get">GET</span><span>Read recovery configuration</span></div>
            <div><span className="method put">PUT</span><span>Update recovery configuration</span></div>
          </div>
        </div>
      </section>
    )}
  </>;
}
function SlidersVisual() { return <div className="sliders-visual"><span /><span /><span /></div>; }




export function SimulationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
    setError(null);
  };

  const handleClear = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const handleRunBatch = async () => {
    if (!file) return;
    setRunning(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiRequest<any>('/api/simulation/batch/csv', {
        method: 'POST',
        body: formData,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Simulation failed.');
    } finally {
      setRunning(false);
    }
  };

  return <><PageIntro eyebrow="Lab · controlled inputs" title="Simulation" description="Upload a CSV of failed payments and see Revive's recovery decisions." action={<StatusPill tone="green">CONNECTED</StatusPill>} />
    <div className="simulation-grid">
      <section className="upload-card card">
        <div className="upload-art"><Upload size={23} /></div>
        <span className="eyebrow">01 · File input</span>
        <h2>CSV upload</h2>
        <p>Columns needed: customerName, amount, failureCode, failureReason, retryCount (optional).</p>
        <label className={`dropzone ${file ? 'uploaded' : ''}`}>
          <input type="file" accept=".csv" onChange={handleFileChange} data-testid="input-upload-csv" />
          <FileUp size={20} />
          <strong>{file ? file.name : 'Choose a CSV file'}</strong>
          <small>{file ? 'Ready to run' : 'CSV only · no upload sent yet'}</small>
        </label>
        <button className="button button-secondary button-wide" onClick={handleClear} data-testid="button-clear-upload">Clear file</button>
      </section>
      <section className="batch-card card">
        <div className="upload-art dark"><Blocks size={23} /></div>
        <span className="eyebrow">02 · Batch runner</span>
        <h2>Batch simulation</h2>
        <p>Revive evaluates each row and decides: retry, promise-to-pay, or escalate.</p>

        {!result && !running && (
          <div className="batch-empty">
            <CircleDashedMark />
            <strong>{file ? 'Ready to run' : 'Upload a file first'}</strong>
            <span>{file ? 'Click start batch below' : 'No file selected yet'}</span>
          </div>
        )}

        {running && (
          <div className="batch-empty">
            <CircleDashedMark />
            <strong>Running simulation…</strong>
            <span>Evaluating each payment</span>
          </div>
        )}

        {error && <div className="auth-feedback error" style={{ marginBottom: 12 }}>{error}</div>}

        {result && (
          <div className="batch-empty">
            <CircleDashedMark />
            <strong>{result.summary?.processed} of {result.summary?.total} processed</strong>
            <span>Retry: {result.summary?.retryPayment} · Promise-to-pay: {result.summary?.promiseToPay} · Escalated: {result.summary?.escalatedHuman} · Stopped: {result.summary?.stopped}</span>
          </div>
        )}

        <button className="button button-primary button-wide" disabled={!file || running} onClick={handleRunBatch} data-testid="button-start-batch">
          <PlayMark />{running ? 'Running…' : 'Start batch'}<ArrowUpRight size={14} />
        </button>
      </section>
    </div>

    {result?.results?.length > 0 && (
      <section className="card" style={{ marginTop: 24, padding: 20 }}>
        <h2 style={{ marginBottom: 16 }}>Decisions</h2>
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: 8 }}>Customer</th>
              <th style={{ padding: 8 }}>Amount</th>
              <th style={{ padding: 8 }}>Failure</th>
              <th style={{ padding: 8 }}>Action</th>
              <th style={{ padding: 8 }}>Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {result.results.map((r: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{r.customerName}</td>
                <td style={{ padding: 8 }}>₹{r.amount}</td>
                <td style={{ padding: 8 }}>{r.failureReason || r.failureCode}</td>
                <td style={{ padding: 8 }}>{r.action}</td>
                <td style={{ padding: 8 }}>{r.reasoning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )}
  </>;
}

function CircleDashedMark() { return <span className="empty-icon small"><Activity size={16} /></span>; }
function PlayMark() { return <span className="play-mark"><Zap size={13} /></span>; }



export function VoicePage() {
  const [selectedAction, setSelectedAction] = useState<'Start' | 'Transcript' | 'Call'>('Start');

  // Start
  const [startCaseId, setStartCaseId] = useState('');
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startResult, setStartResult] = useState<any>(null);

  // Transcript
  const [transcriptCaseId, setTranscriptCaseId] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptResult, setTranscriptResult] = useState<any>(null);

  // Call
  const [callCaseId, setCallCaseId] = useState('');
  const [callTo, setCallTo] = useState('');
  const [callCustomerName, setCallCustomerName] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<any>(null);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartLoading(true);
    setStartError(null);
    setStartResult(null);
    try {
      const response = await apiRequest<any>('/api/voice/start', {
        method: 'POST',
        body: { recoveryCaseId: startCaseId },
      });
      setStartResult(response);
    } catch (err) {
      setStartError(err instanceof ApiRequestError ? err.message : 'Start failed.');
    } finally {
      setStartLoading(false);
    }
  };

  const handleTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    setTranscriptLoading(true);
    setTranscriptError(null);
    setTranscriptResult(null);
    try {
      const response = await apiRequest<any>('/api/voice/transcript', {
        method: 'POST',
        body: { recoveryCaseId: transcriptCaseId, voiceTranscript },
      });
      setTranscriptResult(response);
    } catch (err) {
      setTranscriptError(err instanceof ApiRequestError ? err.message : 'Transcript failed.');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setCallLoading(true);
    setCallError(null);
    setCallResult(null);
    try {
      const response = await apiRequest<any>('/api/voice/call', {
        method: 'POST',
        body: { recoveryCaseId: callCaseId, to: callTo, customerName: callCustomerName || undefined },
      });
      setCallResult(response);
    } catch (err) {
      setCallError(err instanceof ApiRequestError ? err.message : 'Call failed.');
    } finally {
      setCallLoading(false);
    }
  };

  return <>
    <PageIntro
      eyebrow="Voice · telephony actions"
      title="Voice"
      description="Start a voice recovery session, feed a transcript, or trigger a real Twilio call."
      action={<StatusPill tone="green">CONNECTED</StatusPill>}
    />

    <section className="voice-console card" style={{ padding: 24 }}>
      <div className="segmented" style={{ marginBottom: 20 }}>
        <button type="button" className={selectedAction === 'Start' ? 'active' : ''} onClick={() => setSelectedAction('Start')}>Start</button>
        <button type="button" className={selectedAction === 'Transcript' ? 'active' : ''} onClick={() => setSelectedAction('Transcript')}>Transcript</button>
        <button type="button" className={selectedAction === 'Call' ? 'active' : ''} onClick={() => setSelectedAction('Call')}>Call</button>
      </div>

      {selectedAction === 'Start' && (
        <form onSubmit={handleStart} className="auth-form" style={{ maxWidth: 480 }}>
          <label><span>Recovery Case ID</span><input type="text" value={startCaseId} onChange={(e) => setStartCaseId(e.target.value)} placeholder="Mongo ObjectId" required /></label>
          <button className="button button-primary button-wide" type="submit" disabled={startLoading}>
            {startLoading ? 'Starting…' : 'Run Start'}
          </button>
          {startError && <div className="auth-feedback error" style={{ marginTop: 16 }}>{startError}</div>}
          {startResult && (
            <div className="card" style={{ marginTop: 20, padding: 16, background: '#f5f5f5' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{JSON.stringify(startResult, null, 2)}</pre>
            </div>
          )}
        </form>
      )}

      {selectedAction === 'Transcript' && (
        <form onSubmit={handleTranscript} className="auth-form" style={{ maxWidth: 480 }}>
          <label><span>Recovery Case ID</span><input type="text" value={transcriptCaseId} onChange={(e) => setTranscriptCaseId(e.target.value)} placeholder="Mongo ObjectId" required /></label>
          <label><span>Voice transcript</span><input type="text" value={voiceTranscript} onChange={(e) => setVoiceTranscript(e.target.value)} placeholder="Main kal payment kar dunga" required /></label>
          <button className="button button-primary button-wide" type="submit" disabled={transcriptLoading}>
            {transcriptLoading ? 'Processing…' : 'Run Transcript'}
          </button>
          {transcriptError && <div className="auth-feedback error" style={{ marginTop: 16 }}>{transcriptError}</div>}
          {transcriptResult && (
            <div className="card" style={{ marginTop: 20, padding: 16, background: '#f5f5f5' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{JSON.stringify(transcriptResult, null, 2)}</pre>
            </div>
          )}
        </form>
      )}

      {selectedAction === 'Call' && (
        <form onSubmit={handleCall} className="auth-form" style={{ maxWidth: 480 }}>
          <div className="auth-feedback" style={{ marginBottom: 16 }}>
            ⚠️ This triggers a real Twilio phone call. Only use with a verified number.
          </div>
          <label><span>Recovery Case ID</span><input type="text" value={callCaseId} onChange={(e) => setCallCaseId(e.target.value)} placeholder="Mongo ObjectId" required /></label>
          <label><span>Phone number</span><input type="text" value={callTo} onChange={(e) => setCallTo(e.target.value)} placeholder="+919999999999" required /></label>
          <label><span>Customer name (optional)</span><input type="text" value={callCustomerName} onChange={(e) => setCallCustomerName(e.target.value)} placeholder="Rahul" /></label>
          <button className="button button-primary button-wide" type="submit" disabled={callLoading}>
            {callLoading ? 'Calling…' : 'Run Call'}
          </button>
          {callError && <div className="auth-feedback error" style={{ marginTop: 16 }}>{callError}</div>}
          {callResult && (
            <div className="card" style={{ marginTop: 20, padding: 16, background: '#f5f5f5' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{JSON.stringify(callResult, null, 2)}</pre>
            </div>
          )}
        </form>
      )}
    </section>
  </>;
}




export function WhatsAppPage() {
  const [action, setAction] = useState('Send');

  const [recoveryCaseId, setRecoveryCaseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleRunSend = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiRequest<any>('/api/communication/send', {
        method: 'POST',
        body: { recoveryCaseId, channel: 'WHATSAPP' },
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Send failed.');
    } finally {
      setLoading(false);
    }
  };

  return <>
    <PageIntro
      eyebrow="Channels · confirmed endpoint"
      title="WhatsApp / Twilio"
      description="Send a WhatsApp recovery message through Twilio."
      action={<StatusPill tone="green">CONNECTED</StatusPill>}
    />
    <section className="whatsapp-layout">
      <div className="channel-panel card">
        <div className="channel-brand"><span className="wa-mark"><Send size={20} /></span><div><span className="eyebrow">Outbound channel</span><h2>WhatsApp action</h2></div></div>
        <div className="segmented">
          {['Send', 'Status', 'Webhook'].map((tab) => (
            <button key={tab} className={action === tab ? 'active' : ''} onClick={() => setAction(tab)} data-testid={`button-whatsapp-${tab.toLowerCase()}`}>{tab}</button>
          ))}
        </div>

        {action === 'Send' && (
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', marginBottom: 4 }}>Recovery Case ID</span>
              <input type="text" value={recoveryCaseId} onChange={(e) => setRecoveryCaseId(e.target.value)} placeholder="Mongo ObjectId" style={{ width: '100%' }} />
            </label>
            <button className="button button-primary button-wide" disabled={loading || !recoveryCaseId} onClick={handleRunSend} data-testid="button-run-whatsapp">
              <Send size={15} />{loading ? 'Sending…' : 'Run Send'}<ArrowUpRight size={14} />
            </button>
            {error && <div className="auth-feedback error" style={{ marginTop: 16 }}>{error}</div>}
            {result && (
              <div className="card" style={{ marginTop: 16, padding: 16, background: '#f5f5f5' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {action === 'Status' && (
          <div className="channel-empty">
            <MessageCircle size={22} />
            <strong>No status-check endpoint</strong>
            <p>The backend does not expose a delivery-status lookup route yet — message status would need to come from a Twilio status callback.</p>
          </div>
        )}

        {action === 'Webhook' && (
          <div className="channel-empty">
            <MessageCircle size={22} />
            <strong>Twilio-triggered, not user-triggered</strong>
            <p>POST /api/twilio/whatsapp receives incoming customer replies directly from Twilio. It can't be run from this UI — it fires automatically when a customer messages back.</p>
          </div>
        )}
      </div>

      <div className="twilio-panel card">
        <div className="twilio-header"><Network size={19} /><div><h3>Twilio boundary</h3><p>One integration, explicit state.</p></div></div>
        <IntegrationRow name="Twilio" icon={<Phone size={17} />} state="Trial account — verified numbers only" />
        <IntegrationRow name="WhatsApp" icon={<MessageCircle size={17} />} state="Send endpoint connected" />
        <ContractNotice title="Trial account limitation" detail="Twilio trial accounts can only send WhatsApp messages to verified recipient numbers. Verify the test number in the Twilio console before demoing." />
      </div>
    </section>
  </>;
}




export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [, navigate] = useLocation();
  const isLogin = mode === 'login';

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [identity, setIdentity] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const result = await apiRequest<{ success: boolean; token: string; merchant: unknown }>(
          '/api/auth/login',
          { method: 'POST', body: { email: identity, password: secret } }
        );
        setAuthToken(result.token);
      } else {
        const result = await apiRequest<{ success: boolean; token: string; merchant: unknown }>(
          '/api/auth/signup',
          { method: 'POST', body: { name, businessName, email: identity, password: secret } }
        );
        setAuthToken(result.token);
      }

      navigate('/');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="auth-page"><div className="auth-aside"><Link href="/" className="brand" data-testid="link-auth-brand"><span className="brand-mark">R</span><span><strong>REVIVE</strong><small>PAYMENT RECOVERY</small></span></Link><div className="auth-quote"><span className="eyebrow">Recovery operations</span><h1>Make the next move <em>visible.</em></h1><p>A calm cockpit for teams who recover revenue without losing the plot.</p></div><div className="auth-aside-foot"><span className="mono">SECURE WORKSPACE</span><span>revive console</span></div></div><main className="auth-main"><div className="auth-form-wrap"><span className="auth-mobile-kicker">REVIVE CONSOLE</span><div className="eyebrow">{isLogin ? 'Welcome back' : 'Create workspace'}</div><h2>{isLogin ? 'Sign in to your console.' : 'Set up your console.'}</h2><p className="auth-copy">{isLogin ? 'Enter your workspace details to continue.' : 'Start with the details your administrator requires.'}</p>
    <form onSubmit={handleSubmit} className="auth-form">
      {!isLogin && (
        <>
          <label><span>Full name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" required /></label>
          <label><span>Business name</span><input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Enter your business name" required /></label>
        </>
      )}
      <label><span>Email</span><input type="email" value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="Enter your email" data-testid="input-auth-identity" required /></label>
      <label><span>Password</span><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Enter your password" data-testid="input-auth-secret" required /></label>
      <button className="button button-primary button-wide" type="submit" disabled={loading} data-testid="button-auth-submit">{loading ? 'Please wait…' : isLogin ? 'Continue' : 'Create workspace'}<ArrowUpRight size={14} /></button>
    </form>
    {error && <div className="auth-feedback error" data-testid="status-auth-feedback">{error}</div>}
    <div className="auth-switch">{isLogin ? 'Need a workspace?' : 'Already have access?'} <Link href={isLogin ? '/signup' : '/login'} data-testid="link-auth-switch">{isLogin ? 'Create one' : 'Sign in'}</Link></div>
  </div></main></div>;
}