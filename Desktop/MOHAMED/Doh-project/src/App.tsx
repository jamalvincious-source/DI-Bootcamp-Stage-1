import { useEffect, useRef, useState, type FormEvent } from 'react';
import AdminDashboard, { type ApplicantApplication, type VisitorRecord } from './AdminDashboard';

type Application = {
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  amount: string;
  term: string;
  employer: string;
  income: string;
};

const steps = ['Your details', 'Loan request', 'Review'];
const currency = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

const initialApplication: Application = {
  fullName: '',
  email: '',
  phone: '',
  nationalId: '',
  amount: '25000',
  term: '12',
  employer: '',
  income: '',
};

function money(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function App() {
  const [view, setView] = useState<'borrower' | 'operations'>('borrower');
  const [applicantPreview, setApplicantPreview] = useState(false);
  const [application, setApplication] = useState(initialApplication);
  const [submittedApplications, setSubmittedApplications] = useState<ApplicantApplication[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [step, setStep] = useState(0);
  const [apr, setApr] = useState('16.5');
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const visitRecorded = useRef(false);

  useEffect(() => {
    if (visitRecorded.current) return;
    visitRecorded.current = true;

    try {
      const visitorKey = 'ondoa-demo-visitor-id';
      const visitsKey = 'ondoa-demo-visits';
      const generatedId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10).padEnd(8, '0');
      const visitorId = sessionStorage.getItem(visitorKey)
        ?? `VIS-${generatedId.toUpperCase()}`;
      sessionStorage.setItem(visitorKey, visitorId);

      const currentTime = new Date().toISOString();
      const previousVisits = JSON.parse(localStorage.getItem(visitsKey) ?? '[]') as VisitorRecord[];
      const existingVisitor = previousVisits.find((visitor) => visitor.visitorId === visitorId);
      const nextVisits = existingVisitor
        ? previousVisits.map((visitor) => visitor.visitorId === visitorId
          ? { ...visitor, lastSeen: currentTime, visits: visitor.visits + 1 }
          : visitor)
        : [...previousVisits, { visitorId, firstSeen: currentTime, lastSeen: currentTime, visits: 1 }];

      localStorage.setItem(visitsKey, JSON.stringify(nextVisits));
      setVisitors(nextVisits);
    } catch {
      setVisitors([]);
    }
  }, []);

  const principal = Math.max(0, Number(application.amount) || 0);
  const months = Math.max(1, Number(application.term) || 1);
  const monthlyRate = (Math.max(0, Number(apr) || 0) / 100) / 12;
  const monthlyPayment = monthlyRate === 0
    ? principal / months
    : principal * monthlyRate / (1 - (1 + monthlyRate) ** -months);
  const totalRepayment = monthlyPayment * months;

  const update = (field: keyof Application, value: string) => {
    setApplication((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formRef.current?.reportValidity()) return;

    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    setSubmittedApplications((current) => [...current, {
      reference: `LN-DEMO-${String(Date.now()).slice(-6)}`,
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      nationalId: application.nationalId,
      amount: principal,
      term: application.term,
      employer: application.employer,
      income: Number(application.income) || 0,
      age: 'Just now',
      status: 'In review',
      paymentStatus: 'Not due',
      source: 'This tab',
    }]);
    setSubmitted(true);
  };

  const changeStep = (nextStep: number) => {
    if (nextStep < step) {
      setStep(nextStep);
      setSubmitted(false);
    }
  };

  const previewApplicant = () => {
    setApplicantPreview(true);
    setView('borrower');
    setStep(0);
    setSubmitted(false);
  };

  const endApplicantPreview = () => {
    setApplicantPreview(false);
    setView('operations');
  };

  const schedule = Array.from({ length: months }, (_, index) => {
    const openingBalance = monthlyRate === 0
      ? Math.max(0, principal - monthlyPayment * index)
      : principal * (1 + monthlyRate) ** index
        - monthlyPayment * ((1 + monthlyRate) ** index - 1) / monthlyRate;
    const interest = openingBalance * monthlyRate;
    const payment = Math.min(monthlyPayment, openingBalance + interest);
    return { month: index + 1, payment, interest, balance: Math.max(0, openingBalance + interest - payment) };
  });

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Ondoa Shida home">
          <span className="brand-mark" aria-hidden="true">OS</span>
          <span>Ondoa <strong>Shida</strong></span>
        </a>
        <nav aria-label="Main navigation">
          <div className="view-switcher" role="group" aria-label="Choose workspace">
            <button type="button" aria-pressed={view === 'borrower' && !applicantPreview} onClick={() => { setApplicantPreview(false); setView('borrower'); }}>Applicant</button>
            <button type="button" aria-pressed={view === 'operations'} onClick={() => { setApplicantPreview(false); setView('operations'); }}>Super admin</button>
          </div>
          {view === 'borrower' && !applicantPreview && <>
            <a href="#estimate">Loan estimate</a>
            <a className="nav-apply" href="#apply">Start application <span aria-hidden="true">↗</span></a>
          </>}
          {applicantPreview && <button className="preview-return" type="button" onClick={endApplicantPreview}>Return to super admin</button>}
        </nav>
      </header>

      {view === 'operations' ? <AdminDashboard
        onPreviewApplicant={previewApplicant}
        submittedApplications={submittedApplications}
        visitors={visitors}
      /> : <>
        {applicantPreview && <div className="preview-banner" role="status">
          <span><strong>Applicant preview</strong> · Demo only. This is not an applicant account or a live session.</span>
          <button type="button" onClick={endApplicantPreview}>Exit preview</button>
        </div>}
        <main id="top">
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> PERSONAL FINANCE, MADE CLEAR</p>
            <h1 id="page-title">Plan well.<br /><span>Move forward.</span></h1>
            <p className="intro-description">Explore a repayment estimate, then prepare your application at your own pace.</p>
          </div>
          <div className="intro-note">
            <span className="note-number">01</span>
            <p>Estimates are for planning only. Final terms depend on review by a lending provider.</p>
          </div>
        </section>

        <div className="workspace">
          <section className="application-panel" id="apply" aria-labelledby="application-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">APPLICATION</p>
                <h2 id="application-title">A few details to get started</h2>
              </div>
              <span className="step-count">STEP {String(step + 1).padStart(2, '0')} <span>/ {String(steps.length).padStart(2, '0')}</span></span>
            </div>

            <ol className="stepper" aria-label="Application progress">
              {steps.map((label, index) => (
                <li key={label} className={index === step ? 'active' : index < step ? 'complete' : ''}>
                  <button type="button" onClick={() => changeStep(index)} disabled={index >= step} aria-current={index === step ? 'step' : undefined}>
                    <span className="step-dot">{index < step ? '✓' : String(index + 1)}</span>
                    <span className="step-label">{label}</span>
                  </button>
                </li>
              ))}
            </ol>

            {submitted ? (
              <div className="success-state" role="status" aria-live="polite">
                <span className="success-icon" aria-hidden="true">✓</span>
                <p className="eyebrow">APPLICATION PREPARED</p>
                <h3>That’s everything for now, {application.fullName.split(' ')[0]}.</h3>
                <p>This demo has not sent your application or documents anywhere. Connect a secure lending service to submit it for review.</p>
                <button className="button button-secondary" type="button" onClick={() => { setSubmitted(false); setStep(0); }}>Review details</button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} noValidate={false}>
                {step === 0 && (
                  <fieldset className="form-step">
                    <legend>Tell us who you are</legend>
                    <p className="step-help">Use the name and contact details associated with your identification.</p>
                    <div className="field-grid">
                      <div className="field field-wide">
                        <label htmlFor="fullName">Full name</label>
                        <input id="fullName" autoComplete="name" required minLength={2} value={application.fullName} onChange={(event) => update('fullName', event.target.value)} />
                      </div>
                      <div className="field">
                        <label htmlFor="phone">Mobile number</label>
                        <input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0712 345 678" pattern="(?:\\+?254|0)?[17][0-9]{8}" title="Enter a valid Kenyan mobile number" required value={application.phone} onChange={(event) => update('phone', event.target.value)} />
                        <span className="field-hint">Demo only: Safaricom line ownership and Kenya ID/contact match require a verification provider; this form does not approve loans.</span>
                      </div>
                      <div className="field">
                        <label htmlFor="email">Email address</label>
                        <input id="email" type="email" autoComplete="email" required value={application.email} onChange={(event) => update('email', event.target.value)} />
                      </div>
                      <div className="field field-wide">
                        <label htmlFor="nationalId">ID number only</label>
                        <input id="nationalId" inputMode="numeric" autoComplete="off" pattern="[0-9]{6,10}" title="Enter 6 to 10 digits only" placeholder="Numbers only" required value={application.nationalId} onChange={(event) => update('nationalId', event.target.value)} />
                        <span className="field-hint">6 to 10 digits. No document upload required.</span>
                      </div>
                    </div>
                  </fieldset>
                )}

                {step === 1 && (
                  <fieldset className="form-step">
                    <legend>Shape your loan request</legend>
                    <p className="step-help">Choose an amount and term that fit your monthly budget.</p>
                    <div className="field-grid">
                      <div className="field">
                        <label htmlFor="amount">Amount requested (KSh)</label>
                        <input id="amount" type="number" min="500" max="300000" step="500" inputMode="numeric" required value={application.amount} onChange={(event) => update('amount', event.target.value)} />
                      </div>
                      <div className="field">
                        <label htmlFor="term">Repayment period</label>
                        <select id="term" required value={application.term} onChange={(event) => update('term', event.target.value)}>
                          <option value="3">3 months</option><option value="6">6 months</option><option value="9">9 months</option><option value="12">12 months</option><option value="18">18 months</option><option value="24">24 months</option><option value="36">36 months</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="employer">Employer or business</label>
                        <input id="employer" autoComplete="organization" required value={application.employer} onChange={(event) => update('employer', event.target.value)} />
                      </div>
                      <div className="field">
                        <label htmlFor="income">Monthly income (KSh)</label>
                        <input id="income" type="number" min="1" step="1" inputMode="numeric" required value={application.income} onChange={(event) => update('income', event.target.value)} />
                      </div>
                    </div>
                    <p className="inline-estimate">Estimated monthly repayment <strong>{money(monthlyPayment)}</strong><a href="#estimate">Adjust estimate</a></p>
                  </fieldset>
                )}

                {step === 2 && (
                  <fieldset className="form-step">
                    <legend>Review before you finish</legend>
                    <p className="step-help">Check your information. Nothing is sent from this demo.</p>
                    <dl className="review-list">
                      <div><dt>Applicant</dt><dd>{application.fullName}<br /><span>{application.email} · {application.phone}</span></dd></div>
                      <div><dt>National ID</dt><dd>{application.nationalId}</dd></div>
                      <div><dt>Loan request</dt><dd>{money(principal)} over {months} months</dd></div>
                      <div><dt>Income</dt><dd>{application.employer}<br /><span>{money(Number(application.income))} per month</span></dd></div>
                    </dl>
                    <p className="privacy-note"><span aria-hidden="true">◇</span> Submitting here only prepares a local demo state. A secure backend is required to submit it for review.</p>
                  </fieldset>
                )}

                <div className="form-actions">
                  {step > 0 ? <button className="button button-back" type="button" onClick={() => setStep((current) => current - 1)}>Back</button> : <span />}
                  <button className="button button-primary" type="submit">{step === steps.length - 1 ? 'Prepare application' : 'Continue'} <span aria-hidden="true">→</span></button>
                </div>
              </form>
            )}
          </section>

          <aside className="estimate-panel" id="estimate" aria-labelledby="estimate-title">
            <div className="estimate-heading">
              <div>
                <p className="eyebrow">PLAN YOUR REPAYMENTS</p>
                <h2 id="estimate-title">Loan estimate</h2>
              </div>
              <span className="estimate-icon" aria-hidden="true">↗</span>
            </div>
            <p className="estimate-description">Change any value to see the estimate update instantly.</p>

            <div className="calculator-fields">
              <div className="field">
                <label htmlFor="calcAmount">Loan amount</label>
                <div className="input-prefix"><span>KSh</span><input id="calcAmount" type="number" min="500" max="300000" step="500" value={application.amount} onChange={(event) => update('amount', event.target.value)} /></div>
              </div>
              <div className="field">
                <label htmlFor="calcTerm">Repayment period</label>
                <select id="calcTerm" value={application.term} onChange={(event) => update('term', event.target.value)}>
                  <option value="3">3 months</option><option value="6">6 months</option><option value="9">9 months</option><option value="12">12 months</option><option value="18">18 months</option><option value="24">24 months</option><option value="36">36 months</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="apr">Estimated APR</label>
                <div className="input-suffix"><input id="apr" type="number" min="0" max="100" step="0.1" value={apr} onChange={(event) => setApr(event.target.value)} /><span>%</span></div>
              </div>
            </div>

            <div className="payment-highlight" aria-live="polite" aria-atomic="true">
              <span>Estimated monthly payment</span>
              <strong>{money(monthlyPayment)}</strong>
              <small>for {months} months</small>
            </div>
            <dl className="estimate-totals">
              <div><dt>Amount borrowed</dt><dd>{money(principal)}</dd></div>
              <div><dt>Total interest</dt><dd>{money(totalRepayment - principal)}</dd></div>
              <div><dt>Total repayment</dt><dd>{money(totalRepayment)}</dd></div>
            </dl>

            <details className="schedule-details">
              <summary>View repayment schedule</summary>
              <div className="table-scroll" tabIndex={0} aria-label="Scrollable repayment schedule">
                <table>
                  <thead><tr><th scope="col">Month</th><th scope="col">Payment</th><th scope="col">Interest</th><th scope="col">Balance</th></tr></thead>
                  <tbody>{schedule.map((row) => <tr key={row.month}><th scope="row">{row.month}</th><td>{money(row.payment)}</td><td>{money(row.interest)}</td><td>{money(row.balance)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
            <p className="estimate-disclaimer">Illustrative estimate using a fixed APR and monthly amortization. Fees and actual lender terms may differ.</p>
          </aside>
        </div>
        </main>
      </>}

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top"><span className="brand-mark" aria-hidden="true">OS</span><span>Ondoa <strong>Shida</strong></span></a>
        <p>{view === 'operations' ? 'Super-admin preview uses sample data only.' : 'Clear estimates. Thoughtful decisions.'}</p>
        <span className="demo-label">DEMO EXPERIENCE</span>
      </footer>
    </>
  );
}

export default App;