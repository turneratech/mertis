import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import logoSmall from '../utils/brandAssets';
import { licenseRegisterUrl } from '../config/licenseServer';
import './SetupWizard.css';

const BASE_STEPS = ['welcome', 'admin', 'database', 'storage', 'license', 'done'];

function SetupWizard({ onComplete, initialStatus = null }) {
  const [status, setStatus] = useState(initialStatus);
  const [step, setStep] = useState(0);
  const [providers, setProviders] = useState(null);
  const [settings, setSettings] = useState({
    database: { provider: 'auto', mysql: { host: 'localhost', port: 3306, user: 'mertis', database: 'mertis', password: '' } },
    storage: { default: 'local' }
  });
  const [adminForm, setAdminForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: ''
  });
  const [authSession, setAuthSession] = useState(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [testing, setTesting] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [organizationName, setOrganizationName] = useState('');

  const steps = useMemo(() => {
    if (status && !status.needsBootstrapAdmin) {
      return BASE_STEPS.filter(s => s !== 'admin');
    }
    return BASE_STEPS;
  }, [status]);

  useEffect(() => {
    if (initialStatus) return;
    axios.get('/api/setup/status')
      .then(res => setStatus(res.data))
      .catch(() => setStatus({ needsSetup: true, needsBootstrapAdmin: true }));
  }, [initialStatus]);

  useEffect(() => {
    axios.get('/api/setup/providers').then(r => setProviders(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (status?.organizationName) {
      setOrganizationName(status.organizationName);
    }
  }, [status]);

  const currentStep = steps[step];
  const stepNum = step + 1;
  const totalSteps = steps.length;

  const showMsg = (type, text) => setMessage({ type, text });

  const testDatabase = async () => {
    setTesting('db');
    try {
      const res = await axios.post('/api/setup/test/database', {
        provider: settings.database.provider,
        config: settings.database
      });
      showMsg(res.data.success ? 'success' : 'error', res.data.message);
    } catch (err) {
      showMsg('error', err.response?.data?.error || err.response?.data?.message || err.message);
    } finally {
      setTesting('');
    }
  };

  const testStorage = async () => {
    setTesting('storage');
    try {
      const res = await axios.post('/api/setup/test/storage', { provider: settings.storage.default });
      showMsg(res.data.success ? 'success' : 'error', res.data.message);
    } catch (err) {
      showMsg('error', err.response?.data?.error || err.message);
    } finally {
      setTesting('');
    }
  };

  const bootstrapAdmin = async () => {
    const { username, password, confirmPassword, email } = adminForm;
    if (!username.trim() || username.trim().length < 3) {
      showMsg('error', 'Username must be at least 3 characters');
      return false;
    }
    if (password.length < 8) {
      showMsg('error', 'Password must be at least 8 characters');
      return false;
    }
    if (password !== confirmPassword) {
      showMsg('error', 'Passwords do not match');
      return false;
    }

    const res = await axios.post('/api/setup/bootstrap-admin', {
      username: username.trim(),
      password,
      email: email.trim()
    });
    setAuthSession(res.data);
    localStorage.setItem('token', res.data.token);
    showMsg('success', `Administrator "${res.data.user.username}" created`);
    return true;
  };

  const saveAndNext = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      if (currentStep === 'welcome') {
        const name = organizationName.trim();
        if (!name) {
          showMsg('error', 'Enter your organization name');
          return;
        }
        await axios.post('/api/setup/settings', { organizationName: name });
      }
      if (currentStep === 'admin') {
        const ok = await bootstrapAdmin();
        if (!ok) return;
      }
      if (currentStep === 'database' || currentStep === 'storage') {
        await axios.post('/api/setup/settings', settings);
        if (currentStep === 'database') {
          showMsg('success', 'Database settings saved. Restart the server after setup for DB changes.');
        }
      }
      if (currentStep === 'license') {
        if (!licenseKey.trim()) {
          showMsg('error', 'Paste the licence key from your registration email');
          return;
        }
        // Activate BEFORE showing the success screen. This used to run on the
        // "Go to Dashboard" button, so "You're all set!" appeared while nothing
        // had been saved -- and if activation then failed, the customer had
        // already been told it worked.
        await axios.post('/api/setup/complete', {
          licenseKey: licenseKey.trim(),
          username: authSession?.user?.username,
          organizationName: organizationName.trim()
        });
      }
      setStep(s => Math.min(s + 1, steps.length - 1));
    } catch (err) {
      showMsg('error', err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  // Setup is already committed by the time the done step renders; this only
  // hands control back to the app.
  const finishSetup = () => onComplete(authSession);

  if (!status) {
    return <div className="setup-wizard"><div className="setup-wizard-card"><p>Loading setup…</p></div></div>;
  }

  return (
    <div className="setup-wizard">
      <div className="setup-wizard-card">
        <div className="setup-brand">
          <img src={logoSmall} alt="Mertis" className="setup-logo" />
        </div>

        <div className="setup-progress">
          Step {stepNum} of {totalSteps}
          <div className="setup-progress-bar">
            <div className="setup-progress-fill" style={{ width: `${(stepNum / totalSteps) * 100}%` }} />
          </div>
        </div>

        {status.instanceId && (
          <p className="setup-instance-id">Instance ID: <code>{status.instanceId}</code></p>
        )}

        {message.text && (
          <div className={`setup-alert setup-alert-${message.type}`}>{message.text}</div>
        )}

        {currentStep === 'welcome' && (
          <div className="setup-step">
            <h1>Welcome to Mertis</h1>
            <p>
              This wizard configures your self-hosted instance. Your administrator account is created
              here on your server — not on turneratech.com.
            </p>
            <ul className="setup-features">
              <li>Record your organization name for confidentiality notices</li>
              <li>Create your local administrator account</li>
              <li>Connect MySQL, PostgreSQL, or Supabase</li>
              <li>Configure file storage (local, S3, Azure)</li>
              <li>Register at turneratech.com and activate your licence (Community is free)</li>
            </ul>
            <label>
              Organization name
              <input
                value={organizationName}
                onChange={e => setOrganizationName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                autoComplete="organization"
                required
              />
            </label>
            <p className="setup-hint">
              Shown on every page in the confidential banner. You can change it later under Deployment.
            </p>
          </div>
        )}

        {currentStep === 'admin' && (
          <div className="setup-step">
            <h2>Create Administrator</h2>
            <p>This account manages your Mertis instance. Choose a strong password.</p>
            <div className="setup-grid">
              <label>
                Username
                <input
                  value={adminForm.username}
                  onChange={e => setAdminForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="admin"
                  autoComplete="username"
                />
              </label>
              <label>
                Email <span className="setup-optional">(optional)</span>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={adminForm.confirmPassword}
                  onChange={e => setAdminForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                />
              </label>
            </div>
          </div>
        )}

        {currentStep === 'database' && (
          <div className="setup-step">
            <h2>Database</h2>
            <p>Choose where Mertis stores bugs, projects, and users.</p>
            <label>
              Provider
              <select
                value={settings.database.provider}
                onChange={e => setSettings(s => ({ ...s, database: { ...s.database, provider: e.target.value } }))}
              >
                {(providers?.databaseProviders || ['auto', 'mysql', 'supabase', 'postgres', 'csv']).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            {['mysql', 'auto'].includes(settings.database.provider) && (
              <div className="setup-grid">
                <label>Host<input value={settings.database.mysql.host} onChange={e => setSettings(s => ({ ...s, database: { ...s.database, mysql: { ...s.database.mysql, host: e.target.value } } }))} /></label>
                <label>Port<input type="number" value={settings.database.mysql.port} onChange={e => setSettings(s => ({ ...s, database: { ...s.database, mysql: { ...s.database.mysql, port: +e.target.value } } }))} /></label>
                <label>User<input value={settings.database.mysql.user} onChange={e => setSettings(s => ({ ...s, database: { ...s.database, mysql: { ...s.database.mysql, user: e.target.value } } }))} /></label>
                <label>Password<input type="password" value={settings.database.mysql.password} onChange={e => setSettings(s => ({ ...s, database: { ...s.database, mysql: { ...s.database.mysql, password: e.target.value } } }))} /></label>
                <label>Database<input value={settings.database.mysql.database} onChange={e => setSettings(s => ({ ...s, database: { ...s.database, mysql: { ...s.database.mysql, database: e.target.value } } }))} /></label>
              </div>
            )}
            {settings.database.provider === 'postgres' && (
              <label>
                Connection string
                <input
                  type="password"
                  placeholder="postgresql://user:password@host:5432/mertis"
                  value={settings.database.postgres?.connectionString || ''}
                  onChange={e => setSettings(s => ({
                    ...s,
                    database: {
                      ...s.database,
                      postgres: { ...s.database.postgres, connectionString: e.target.value }
                    }
                  }))}
                />
              </label>
            )}
            {settings.database.provider === 'supabase' && (
              <div className="setup-grid">
                <label>
                  Project URL
                  <input
                    placeholder="https://xxxxx.supabase.co"
                    value={settings.database.supabase?.url || ''}
                    onChange={e => setSettings(s => ({
                      ...s,
                      database: {
                        ...s.database,
                        supabase: { ...s.database.supabase, url: e.target.value }
                      }
                    }))}
                  />
                </label>
                <label>
                  Connection string
                  <input
                    type="password"
                    placeholder="postgresql://postgres:…@db.xxxxx.supabase.co:5432/postgres"
                    value={settings.database.supabase?.databaseUrl || ''}
                    onChange={e => setSettings(s => ({
                      ...s,
                      database: {
                        ...s.database,
                        supabase: { ...s.database.supabase, databaseUrl: e.target.value }
                      }
                    }))}
                  />
                </label>
              </div>
            )}
            <button type="button" className="btn-secondary" onClick={testDatabase} disabled={testing === 'db'}>
              {testing === 'db' ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        )}

        {currentStep === 'storage' && (
          <div className="setup-step">
            <h2>File Storage</h2>
            <p>Where should bug attachments be stored?</p>
            <label>
              Default provider
              <select
                value={settings.storage.default}
                onChange={e => setSettings(s => ({ ...s, storage: { ...s.storage, default: e.target.value } }))}
              >
                {(providers?.fileStorageProviders || ['local', 's3', 'azure']).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <p className="setup-hint">Configure S3/Azure credentials in <code>.env</code> before selecting cloud storage.</p>
            <button type="button" className="btn-secondary" onClick={testStorage} disabled={testing === 'storage'}>
              {testing === 'storage' ? 'Testing…' : 'Test Storage'}
            </button>
          </div>
        )}

        {currentStep === 'license' && (
          <div className="setup-step">
            <h2>Licence — registration required</h2>
            <p>
              Register free at{' '}
              <a href={licenseRegisterUrl()} target="_blank" rel="noopener noreferrer">
                turneratech.com
              </a>
              . A Community licence key is emailed to you straight away — it looks like{' '}
              <code>TT-XXXX-XXXX-XXXX-XXXX</code>. Paste it below; this server exchanges it for a
              signed licence and then works offline.
            </p>

            <label>
              Licence key
              <textarea
                rows={3}
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value)}
                placeholder="TT-XXXX-XXXX-XXXX-XXXX"
                spellCheck={false}
              />
            </label>

            <p className="setup-hint">
              The key binds to this installation. To move it later, release it first from{' '}
              <strong>Deployment &rarr; License</strong>.
            </p>
            <p className="setup-hint">
              <strong>No internet access?</strong> Paste a signed licence token (a long{' '}
              <code>eyJ…</code> string) into the same box instead — it is verified locally and never
              contacts the licence server.
            </p>
          </div>
        )}

        {currentStep === 'done' && (
          <div className="setup-step">
            <h2>You&apos;re all set!</h2>
            <p>Mertis is configured. Fine-tune settings anytime under <strong>Deployment</strong> in the nav bar.</p>
            {settings.database.provider !== 'csv' && (
              <p className="setup-hint">If you changed the database provider, restart the server before using the app.</p>
            )}
          </div>
        )}

        <div className="setup-actions">
          {step > 0 && currentStep !== 'done' && (
            <button type="button" className="btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          {currentStep !== 'done' && currentStep !== 'license' && (
            <button type="button" className="btn-primary" onClick={saveAndNext} disabled={saving}>
              {saving ? 'Saving…' : 'Continue'}
            </button>
          )}
          {currentStep === 'license' && (
            <button
              type="button"
              className="btn-primary"
              onClick={saveAndNext}
              disabled={saving || !licenseKey.trim()}
            >
              {saving ? 'Activating…' : 'Activate & finish'}
            </button>
          )}
          {currentStep === 'done' && (
            <button type="button" className="btn-primary" onClick={finishSetup} disabled={saving}>
              {saving ? 'Finishing…' : 'Go to Dashboard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetupWizard;
