import { useState } from 'react';
import './AdminDashboard.css';

type LoanStatus = 'In review' | 'Approved' | 'Awaiting documents' | 'Paid out';

export type ApplicantApplication = {
  reference: string;
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  amount: number;
  term: string;
  employer: string;
  income: number;
  age: string;
  status: LoanStatus;
  paymentStatus: 'Paid' | 'Unpaid' | 'Not due';
  source: 'Sample' | 'This tab';
};

export type VisitorRecord = {
  visitorId: string;
  firstSeen: string;
  lastSeen: string;
  visits: number;
};

const applications: ApplicantApplication[] = [
  { reference: 'LN-24081', fullName: 'Sample Applicant 01', email: 'applicant01@example.test', phone: '*** *** 4081', nationalId: '••••••1001', amount: 28500, term: '12', employer: 'Sample employer', income: 54000, age: '12 min ago', status: 'In review', paymentStatus: 'Not due', source: 'Sample' },
  { reference: 'LN-24080', fullName: 'Sample Applicant 02', email: 'applicant02@example.test', phone: '*** *** 4080', nationalId: '••••••1002', amount: 18000, term: '9', employer: 'Sample business', income: 47000, age: '38 min ago', status: 'Awaiting documents', paymentStatus: 'Not due', source: 'Sample' },
  { reference: 'LN-24079', fullName: 'Sample Applicant 03', email: 'applicant03@example.test', phone: '*** *** 4079', nationalId: '••••••1003', amount: 42000, term: '18', employer: 'Sample employer', income: 82000, age: '1 hr ago', status: 'Approved', paymentStatus: 'Not due', source: 'Sample' },
  { reference: 'LN-24078', fullName: 'Sample Applicant 04', email: 'applicant04@example.test', phone: '*** *** 4078', nationalId: '••••••1004', amount: 12000, term: '6', employer: 'Sample business', income: 39000, age: '2 hrs ago', status: 'Paid out', paymentStatus: 'Unpaid', source: 'Sample' },
  { reference: 'LN-24077', fullName: 'Sample Applicant 05', email: 'applicant05@example.test', phone: '*** *** 4077', nationalId: '••••••1005', amount: 67500, term: '24', employer: 'Sample employer', income: 97000, age: '3 hrs ago', status: 'In review', paymentStatus: 'Not due', source: 'Sample' },
];

const initialAlerts = [
  { id: 'FR-1082', type: 'Identity mismatch', detail: 'Document name differs from application record', severity: 'High', age: '8 min ago' },
  { id: 'FR-1081', type: 'Repeated device activity', detail: 'Multiple applications from one device', severity: 'Review', age: '24 min ago' },
  { id: 'FR-1079', type: 'Unusual repayment pattern', detail: 'Payment retry frequency above threshold', severity: 'Review', age: '1 hr ago' },
];

const repaymentRows = [
  { reference: 'LN-23991', applicant: 'Sample Applicant 06', due: 'Today', amount: 4200, status: 'Due today' },
  { reference: 'LN-23976', applicant: 'Sample Applicant 07', due: 'Today', amount: 6800, status: 'Paid' },
  { reference: 'LN-23954', applicant: 'Sample Applicant 08', due: 'Yesterday', amount: 3200, status: '1 day late' },
  { reference: 'LN-23931', applicant: 'Sample Applicant 09', due: 'Yesterday', amount: 5100, status: 'Paid' },
];

const segments = [
  { name: 'Salaried', accounts: 842, balance: 'KSh 18.4M', share: 54 },
  { name: 'Small business', accounts: 516, balance: 'KSh 9.7M', share: 31 },
  { name: 'Gig & contract', accounts: 294, balance: 'KSh 5.1M', share: 15 },
];

const heatmap = [
  { label: 'Low', values: [342, 186, 91] },
  { label: 'Moderate', values: [215, 243, 129] },
  { label: 'Elevated', values: [41, 87, 76] },
];

const ranges = ['30 days', '90 days', '12 months'] as const;
type Range = (typeof ranges)[number];

const chartSeries: Record<Range, { labels: string[]; originations: number[]; repayments: number[] }> = {
  '30 days': {
    labels: ['W1', 'W2', 'W3', 'W4'],
    originations: [45, 58, 52, 72],
    repayments: [38, 43, 48, 57],
  },
  '90 days': {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
    originations: [35, 48, 42, 64, 57, 78],
    repayments: [32, 39, 40, 51, 48, 62],
  },
  '12 months': {
    labels: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
    originations: [31, 42, 39, 58, 63, 78],
    repayments: [26, 34, 41, 45, 52, 63],
  },
};

const money = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

function TrendChart({ range }: { range: Range }) {
  const series = chartSeries[range];
  const chartWidth = 680;
  const chartHeight = 190;
  const left = 36;
  const right = 12;
  const top = 16;
  const bottom = 28;
  const xStep = (chartWidth - left - right) / (series.labels.length - 1);
  const toY = (value: number) => chartHeight - bottom - (value / 100) * (chartHeight - top - bottom);
  const toPath = (values: number[]) => values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${left + index * xStep} ${toY(value)}`).join(' ');

  return (
    <svg className="trend-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-labelledby="trend-title trend-description">
      <title id="trend-title">Loan originations and repayments</title>
      <desc id="trend-description">Sample trend for {range}: originations are shown in green and repayments in orange.</desc>
      {[0, 25, 50, 75, 100].map((value) => (
        <g key={value}>
          <line x1={left} x2={chartWidth - right} y1={toY(value)} y2={toY(value)} className="chart-gridline" />
          <text x="0" y={toY(value) + 4} className="chart-axis-label">{value}</text>
        </g>
      ))}
      <path d={toPath(series.originations)} className="chart-line chart-line-originations" />
      <path d={toPath(series.repayments)} className="chart-line chart-line-repayments" />
      {series.labels.map((label, index) => (
        <text key={label} x={left + index * xStep} y={chartHeight - 5} textAnchor="middle" className="chart-axis-label">{label}</text>
      ))}
    </svg>
  );
}

function AdminDashboard({
  onPreviewApplicant,
  submittedApplications,
  visitors,
}: {
  onPreviewApplicant: () => void;
  submittedApplications: ApplicantApplication[];
  visitors: VisitorRecord[];
}) {
  const [range, setRange] = useState<Range>('30 days');
  const [applicationFilter, setApplicationFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [alerts, setAlerts] = useState(initialAlerts);
  const [selectedApplicant, setSelectedApplicant] = useState<string | null>(null);

  const allApplications = [...submittedApplications, ...applications];
  const filteredApplications = allApplications.filter((application) => {
    const matchesStatus = applicationFilter === 'All' || application.status === applicationFilter;
    const searchTerm = search.toLowerCase();
    return matchesStatus && (application.reference.toLowerCase().includes(searchTerm)
      || application.fullName.toLowerCase().includes(searchTerm));
  });
  const selectedApplication = allApplications.find((application) => application.reference === selectedApplicant);

  const acknowledgeAlert = (id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  };

  return (
    <main className="admin-dashboard" id="top">
      <div className="admin-topline">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> SUPER ADMIN · DEMO</p>
          <h1 className="admin-title">Control <span>center.</span></h1>
          <p className="admin-subtitle">Review portfolio operations and preview the applicant experience.</p>
        </div>
        <div className="admin-topline-actions">
          <div className="sample-stamp" role="status"><span aria-hidden="true" /> SAMPLE DATA · NOT CONNECTED</div>
          <button className="applicant-preview-button" type="button" onClick={onPreviewApplicant}>Preview as applicant <span aria-hidden="true">↗</span></button>
        </div>
      </div>

      <section className="visitor-section" aria-labelledby="visitors-heading">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">ANONYMOUS · THIS BROWSER ONLY</p>
            <h2 id="visitors-heading">Website visits</h2>
          </div>
          <span className="chart-unit">No names, contact details, or IP addresses collected</span>
        </div>
        <div className="admin-table-scroll" tabIndex={0} aria-label="Anonymous local website visit history">
          <table className="admin-table visitor-table">
            <thead><tr><th scope="col">Visitor ID</th><th scope="col">First seen</th><th scope="col">Last seen</th><th scope="col">Visits</th></tr></thead>
            <tbody>{visitors.map((visitor) => (
              <tr key={visitor.visitorId}>
                <th scope="row">{visitor.visitorId}</th>
                <td>{new Date(visitor.firstSeen).toLocaleString('en-KE')}</td>
                <td>{new Date(visitor.lastSeen).toLocaleString('en-KE')}</td>
                <td>{visitor.visits}</td>
              </tr>
            ))}</tbody>
          </table>
          {visitors.length === 0 && <p className="empty-state">Visit data is unavailable in this browser session.</p>}
        </div>
      </section>

      <section className="metric-strip" aria-label="Portfolio key performance indicators">
        <article className="metric-item">
          <span className="metric-label">Active loan book</span>
          <strong>KSh 33.2M</strong>
          <span className="metric-trend positive">↑ 8.4% <span>vs prior period</span></span>
        </article>
        <article className="metric-item">
          <span className="metric-label">Applications this month · sample</span>
          <strong>386</strong>
          <span className="metric-trend positive">↑ 12.1% <span>vs prior period</span></span>
        </article>
        <article className="metric-item">
          <span className="metric-label">Repayment rate</span>
          <strong>94.8%</strong>
          <span className="metric-trend positive">↑ 1.2 pts <span>vs prior period</span></span>
        </article>
        <article className="metric-item">
          <span className="metric-label">Portfolio at risk · 30d</span>
          <strong>4.6%</strong>
          <span className="metric-trend caution">− 0.3 pts <span>vs prior period</span></span>
        </article>
      </section>

      <section className="pipeline-section" aria-labelledby="pipeline-heading">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">SAMPLE RECORDS + THIS TAB</p>
            <h2 id="pipeline-heading">Loan pipeline</h2>
          </div>
          <label className="search-field">
            <span className="visually-hidden">Search applicant or loan reference</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant or reference" />
          </label>
        </div>
        <div className="pipeline-flow" aria-label="Application counts by stage">
          {[
            { name: 'Received', count: '42', className: 'received' },
            { name: 'In review', count: '18', className: 'review' },
            { name: 'Approved', count: '11', className: 'approved' },
            { name: 'Disbursed', count: '27', className: 'disbursed' },
          ].map((stage) => (
            <div className={`pipeline-stage ${stage.className}`} key={stage.name}>
              <span>{stage.name}</span><strong>{stage.count}</strong>
            </div>
          ))}
        </div>
        <div className="table-toolbar">
          <h3>Applications <span>{filteredApplications.length} shown</span></h3>
          <label className="filter-field">Status
            <select value={applicationFilter} onChange={(event) => setApplicationFilter(event.target.value)}>
              <option>All</option><option>In review</option><option>Approved</option><option>Awaiting documents</option><option>Paid out</option>
            </select>
          </label>
        </div>
        <div className="admin-table-scroll" tabIndex={0} aria-label="Scrollable loan application list">
          <table className="admin-table">
            <thead><tr><th scope="col">Applicant</th><th scope="col">Reference</th><th scope="col">Requested</th><th scope="col">Loan status</th><th scope="col">Payment</th><th scope="col">Updated</th></tr></thead>
            <tbody>{filteredApplications.map((application) => (
              <tr key={application.reference}>
                <th scope="row"><button className="applicant-name-button" type="button" onClick={() => setSelectedApplicant(application.reference)}>{application.fullName}</button></th>
                <td>{application.reference}{application.source === 'This tab' ? ' · local' : ''}</td>
                <td>{money.format(application.amount)}</td>
                <td><span className={`status-pill status-${application.status.toLowerCase().replaceAll(' ', '-')}`}>{application.status}</span></td>
                <td><span className={`status-pill status-${application.paymentStatus.toLowerCase().replaceAll(' ', '-')}`}>{application.paymentStatus}</span></td>
                <td>{application.age}</td>
              </tr>
            ))}</tbody>
          </table>
          {filteredApplications.length === 0 && <p className="empty-state">No applications match those filters.</p>}
        </div>
        {selectedApplication && <section className="applicant-detail" aria-labelledby="applicant-detail-heading">
          <div className="applicant-detail-heading">
            <div><p className="eyebrow">{selectedApplication.source === 'Sample' ? 'ILLUSTRATIVE RECORD' : 'LOCAL DEMO SUBMISSION'}</p><h3 id="applicant-detail-heading">{selectedApplication.fullName}</h3></div>
            <button className="detail-close" type="button" onClick={() => setSelectedApplicant(null)} aria-label="Close applicant details">×</button>
          </div>
          <dl className="applicant-detail-grid">
            <div><dt>Application reference</dt><dd>{selectedApplication.reference}</dd></div>
            <div><dt>Email</dt><dd>{selectedApplication.email}</dd></div>
            <div><dt>Phone</dt><dd>{selectedApplication.phone}</dd></div>
            <div><dt>National ID</dt><dd>••••••{selectedApplication.nationalId.slice(-4)}</dd></div>
            <div><dt>Employer or business</dt><dd>{selectedApplication.employer}</dd></div>
            <div><dt>Monthly income</dt><dd>{money.format(selectedApplication.income)}</dd></div>
            <div><dt>Loan request</dt><dd>{money.format(selectedApplication.amount)} over {selectedApplication.term} months</dd></div>
            <div><dt>Loan and payment status</dt><dd>{selectedApplication.status} · {selectedApplication.paymentStatus}</dd></div>
          </dl>
        </section>}
      </section>

      <div className="analytics-grid">
        <section className="analytics-section trend-section" aria-labelledby="trend-heading">
          <div className="admin-section-heading">
            <div><p className="eyebrow">PERFORMANCE</p><h2 id="trend-heading">Originations & repayments</h2></div>
            <label className="filter-field">Period
              <select value={range} onChange={(event) => setRange(event.target.value as Range)}>
                {ranges.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="chart-legend"><span><i className="legend-originations" />Originations</span><span><i className="legend-repayments" />Repayments</span><span className="chart-unit">KSh millions · sample</span></div>
          <TrendChart range={range} />
        </section>

        <section className="analytics-section alert-section" aria-labelledby="alerts-heading">
          <div className="admin-section-heading">
            <div><p className="eyebrow">TRIAGE QUEUE · SAMPLE</p><h2 id="alerts-heading">Fraud signals <span className="alert-count">{alerts.length}</span></h2></div>
          </div>
          <ul className="alert-list">
            {alerts.map((alert) => (
              <li key={alert.id} className="alert-row">
                <span className={`severity-mark severity-${alert.severity.toLowerCase()}`} aria-hidden="true" />
                <div className="alert-copy"><div><strong>{alert.type}</strong><span className={`severity-text severity-text-${alert.severity.toLowerCase()}`}>{alert.severity}</span></div><p>{alert.detail}</p><small>{alert.id} · {alert.age}</small></div>
                <button type="button" className="acknowledge-button" onClick={() => acknowledgeAlert(alert.id)} aria-label={`Acknowledge sample alert ${alert.id}`}>Acknowledge</button>
              </li>
            ))}
            {alerts.length === 0 && <li className="empty-state">All sample alerts acknowledged.</li>}
          </ul>
        </section>

        <section className="analytics-section risk-section" aria-labelledby="risk-heading">
          <div className="admin-section-heading">
            <div><p className="eyebrow">RISK DISTRIBUTION · SAMPLE</p><h2 id="risk-heading">Risk heatmap</h2></div>
          </div>
          <div className="heatmap-scroll" tabIndex={0} aria-label="Scrollable risk distribution table">
            <table className="risk-table">
              <thead><tr><th scope="col">Risk band</th><th scope="col">Salaried</th><th scope="col">Small business</th><th scope="col">Gig & contract</th></tr></thead>
              <tbody>{heatmap.map((row) => (
                <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td className={`heat-cell heat-${row.label.toLowerCase()}`} key={index}>{value}<span className="visually-hidden"> accounts</span></td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          <p className="chart-unit">Accounts in each illustrative segment. Not a credit decision.</p>
        </section>

        <section className="analytics-section segment-section" aria-labelledby="segments-heading">
          <div className="admin-section-heading">
            <div><p className="eyebrow">PORTFOLIO MIX · SAMPLE</p><h2 id="segments-heading">Customer segments</h2></div>
          </div>
          <div className="segment-list">
            {segments.map((segment) => (
              <div className="segment-row" key={segment.name}>
                <div className="segment-label"><strong>{segment.name}</strong><span>{segment.accounts.toLocaleString()} accounts</span><b>{segment.share}%</b></div>
                <div className="segment-track" role="img" aria-label={`${segment.name}: ${segment.share}% of sample portfolio`}><span style={{ width: `${segment.share}%` }} /></div>
                <span className="segment-balance">{segment.balance} outstanding</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="repayment-section" aria-labelledby="repayment-heading">
        <div className="admin-section-heading">
          <div><p className="eyebrow">COLLECTIONS · SAMPLE</p><h2 id="repayment-heading">Who has paid</h2></div>
          <a href="#top" className="text-link">View collection queue <span aria-hidden="true">→</span></a>
        </div>
        <div className="admin-table-scroll" tabIndex={0} aria-label="Scrollable repayment tracking list">
          <table className="admin-table repayment-table">
            <thead><tr><th scope="col">Applicant</th><th scope="col">Loan reference</th><th scope="col">Due</th><th scope="col">Amount</th><th scope="col">Payment status</th></tr></thead>
            <tbody>{repaymentRows.map((row) => (
              <tr key={row.reference}><th scope="row">{row.applicant}</th><td>{row.reference}</td><td>{row.due}</td><td>{money.format(row.amount)}</td><td><span className={`status-pill status-${row.status.toLowerCase().replaceAll(' ', '-')}`}>{row.status}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <p className="admin-footnote">Loan and repayment records are illustrative; new submissions and anonymous visit counts exist only in this tab/browser demo. National IDs are masked. This dashboard is not connected to shared storage or protected by a real admin role. Fraud indicators require human review and must not be used alone to approve or decline credit.</p>
    </main>
  );
}

export default AdminDashboard;