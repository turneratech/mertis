import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import { useLicense } from '../hooks/useLicense';
import { useBranding } from '../hooks/useBranding';
import './DeploymentConfig.css';

// Initial-capping the tab id would render 'ai' as 'Ai'.
const TAB_LABELS = { ai: 'AI' };

const EMPTY_WEBHOOK = { id: '', name: '', url: '', secret: '', events: ['*'], enabled: true };

function DeploymentConfig() {
  const { user } = useAuth();
  const isGodmode = user?.role === 'godmode';
  const { license, activateLicense, refreshLicense } = useLicense();
  const { refreshBranding } = useBranding();
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseLimits, setLicenseLimits] = useState(null);
  const [activating, setActivating] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statusRes, providersRes, pluginsRes] = await Promise.all([
        axios.get('/api/deployment/status'),
        axios.get('/api/deployment/providers'),
        axios.get('/api/deployment/plugins')
      ]);
      setStatus(statusRes.data);
      setSettings(statusRes.data.settings || {});
      setProviders(providersRes.data);
      setPlugins(pluginsRes.data.loaded || []);
      try {
        const limitsRes = await axios.get('/api/license/limits');
        setLicenseLimits(limitsRes.data);
      } catch {
        setLicenseLimits(null);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load deployment config' });
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 6000);
  };

  const updateDatabase = (field, value) => {
    setSettings(prev => ({
      ...prev,
      database: { ...prev.database, [field]: value }
    }));
  };

  const updateMysql = (field, value) => {
    setSettings(prev => ({
      ...prev,
      database: {
        ...prev.database,
        mysql: { ...prev.database?.mysql, [field]: value }
      }
    }));
  };

  const updateStorageDefault = (value) => {
    setSettings(prev => ({
      ...prev,
      storage: { ...prev.storage, default: value }
    }));
  };

  // Credential accessors. The server returns null for a provider that has never
  // been configured, so default to {} rather than guarding at every field.
  const s3 = () => settings.storage?.s3 || {};
  const az = () => settings.storage?.azure || {};
  const sp = () => settings.storage?.sharepoint || {};

  const setStorage = (provider, field, value) => {
    setSettings(prev => ({
      ...prev,
      storage: {
        ...prev.storage,
        [provider]: { ...(prev.storage?.[provider] || {}), [field]: value }
      }
    }));
  };

  const setAi = (field, value) => {
    setSettings(prev => ({ ...prev, ai: { ...(prev.ai || {}), [field]: value } }));
  };

  const addWebhook = () => {
    setSettings(prev => ({
      ...prev,
      webhooks: [...(prev.webhooks || []), { ...EMPTY_WEBHOOK, id: `wh_${Date.now()}` }]
    }));
  };

  const updateWebhook = (index, field, value) => {
    setSettings(prev => {
      const webhooks = [...(prev.webhooks || [])];
      webhooks[index] = { ...webhooks[index], [field]: value };
      return { ...prev, webhooks };
    });
  };

  const removeWebhook = (index) => {
    setSettings(prev => ({
      ...prev,
      webhooks: prev.webhooks.filter((_, i) => i !== index)
    }));
  };

  const testDatabase = async () => {
    setTesting('database');
    try {
      const res = await axios.post('/api/deployment/test/database', {
        provider: settings.database?.provider,
        config: settings.database
      });
      showMsg(res.data.success ? 'success' : 'error', res.data.message + (res.data.note ? ` — ${res.data.note}` : ''));
    } catch (err) {
      showMsg('error', err.response?.data?.message || err.message);
    } finally {
      setTesting('');
    }
  };

  const testStorage = async () => {
    setTesting('storage');
    try {
      const res = await axios.post('/api/deployment/test/storage', {
        provider: settings.storage?.default
      });
      showMsg(res.data.success ? 'success' : 'error', res.data.message);
    } catch (err) {
      showMsg('error', err.response?.data?.message || err.message);
    } finally {
      setTesting('');
    }
  };

  const testWebhook = async (url, secret) => {
    setTesting('webhook');
    try {
      const res = await axios.post('/api/deployment/test/webhook', { url, secret });
      showMsg(res.data.success ? 'success' : 'error', res.data.message);
    } catch (err) {
      showMsg('error', err.message);
    } finally {
      setTesting('');
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) {
      showMsg('error', 'Enter a license key');
      return;
    }
    setActivating(true);
    try {
      await activateLicense(licenseKey.trim());
      await refreshLicense();
      setLicenseKey('');
      showMsg('success', 'License activated successfully');
      await loadAll();
    } catch (err) {
      showMsg('error', err.response?.data?.error || err.message);
    } finally {
      setActivating(false);
    }
  };

  const handleReleaseLicense = async () => {
    if (!window.confirm(
      'Release this licence so the same key can be activated on another install? This install will fall back to Community Edition. Your data is untouched.'
    )) return;
    try {
      const res = await axios.post('/api/license/release');
      await refreshLicense();
      showMsg('success', res.data.message || 'Licence released');
      await loadAll();
    } catch (err) {
      showMsg('error', err.response?.data?.error || err.message);
    }
  };

  const handleDeactivateLicense = async () => {
    if (!window.confirm('Revert to Community Edition?')) return;
    try {
      await axios.delete('/api/license/deactivate');
      await refreshLicense();
      showMsg('success', 'Reverted to Community Edition');
      await loadAll();
    } catch (err) {
      showMsg('error', err.response?.data?.error || err.message);
    }
  };

  const saveSettings = async () => {
    if (!isGodmode && user?.role !== 'admin') {
      showMsg('error', 'Admin access required to save deployment settings');
      return;
    }
    try {
      const res = await axios.post('/api/deployment/settings', settings);
      showMsg('success', res.data.message || 'Settings saved');
      if (res.data.restartRequired) {
        showMsg('success', 'Restart the Mertis server for database changes to apply.');
      }
      await loadAll();
      await refreshBranding();
    } catch (err) {
      showMsg('error', err.response?.data?.error || 'Save failed');
    }
  };

  if (loading) {
    return <div className="deployment-config loading">Loading deployment configuration…</div>;
  }

  return (
    <div className="deployment-config">
      <div className="deployment-header">
        <h1>Deployment Configuration</h1>
        <p className="deployment-subtitle">
          Connect your own database, cloud storage, and webhook integrations — self-hosted like enterprise bug trackers.
        </p>
      </div>

      {message.text && (
        <div className={`deployment-alert deployment-alert-${message.type}`}>{message.text}</div>
      )}

      <div className="deployment-tabs">
        {['overview', 'database', 'storage', 'ai', 'webhooks', 'plugins', 'license'].map(tab => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && status && (
        <div className="deployment-panel">
          <div className="deployment-cards">
            <div className="deployment-card">
              <h3>Database</h3>
              <p><strong>Provider:</strong> {status.database?.provider}</p>
              <p><strong>Runtime:</strong> {status.runtime?.databaseType} {status.runtime?.databaseConnected ? '✓' : '✗'}</p>
            </div>
            <div className="deployment-card">
              <h3>File Storage</h3>
              <p><strong>Default:</strong> {status.storage?.default}</p>
              <p><strong>Providers:</strong> {(status.storage?.providers || []).join(', ')}</p>
            </div>
            <div className="deployment-card">
              <h3>License</h3>
              <p><strong>Tier:</strong> {license.tier}</p>
              <p><strong>Status:</strong> {license.status}</p>
            </div>
            <div className="deployment-card">
              <h3>Webhooks</h3>
              <p><strong>Active:</strong> {status.webhooks?.count || 0}</p>
              <p><strong>Enabled:</strong> {status.webhooks?.enabled ? 'Yes' : 'No'}</p>
            </div>
          </div>
          <p className="deployment-hint">
            Configure via environment variables (.env) for production secrets, or save non-secret overrides here.
            See <code>docs/DEPLOYMENT.md</code> for Supabase, S3, Azure, and webhook setup.
          </p>
          <label>
            Organization name
            <input
              value={settings?.organizationName || ''}
              onChange={e => setSettings(prev => ({ ...prev, organizationName: e.target.value }))}
              placeholder="Customer organization (confidential notices)"
            />
          </label>
          <p className="deployment-hint">
            Used in login, footer, email reports, and PDF confidential notices instead of a vendor name.
          </p>
        </div>
      )}

      {activeTab === 'database' && settings && (
        <div className="deployment-panel">
          <label>
            Database Provider
            <select
              value={settings.database?.provider || 'auto'}
              onChange={e => updateDatabase('provider', e.target.value)}
            >
              {(providers?.databaseProviders || []).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          {['mysql', 'auto'].includes(settings.database?.provider) && (
            <div className="deployment-grid">
              <label>Host<input value={settings.database?.mysql?.host || ''} onChange={e => updateMysql('host', e.target.value)} /></label>
              <label>Port<input type="number" value={settings.database?.mysql?.port || 3306} onChange={e => updateMysql('port', e.target.value)} /></label>
              <label>User<input value={settings.database?.mysql?.user || ''} onChange={e => updateMysql('user', e.target.value)} /></label>
              <label>Password<input type="password" value={settings.database?.mysql?.password || ''} onChange={e => updateMysql('password', e.target.value)} placeholder="Leave blank to keep existing" /></label>
              <label>Database<input value={settings.database?.mysql?.database || ''} onChange={e => updateMysql('database', e.target.value)} /></label>
            </div>
          )}

          {['supabase', 'postgres'].includes(settings.database?.provider) && (
            <div className="deployment-grid">
              <label>Supabase URL<input value={settings.database?.supabase?.url || ''} onChange={e => setSettings(p => ({ ...p, database: { ...p.database, supabase: { ...p.database?.supabase, url: e.target.value } } }))} placeholder="https://xxx.supabase.co" /></label>
              <label>Service Role Key<input type="password" value={settings.database?.supabase?.serviceRoleKey || ''} onChange={e => setSettings(p => ({ ...p, database: { ...p.database, supabase: { ...p.database?.supabase, serviceRoleKey: e.target.value } } }))} /></label>
              <label>Postgres URL<input type="password" value={settings.database?.supabase?.databaseUrl || settings.database?.postgres?.connectionString || ''} onChange={e => setSettings(p => ({ ...p, database: { ...p.database, supabase: { ...p.database?.supabase, databaseUrl: e.target.value }, postgres: { connectionString: e.target.value } } }))} placeholder="postgresql://..." /></label>
            </div>
          )}

          <button type="button" className="btn-test" onClick={testDatabase} disabled={testing === 'database'}>
            {testing === 'database' ? 'Testing…' : 'Test Database Connection'}
          </button>
        </div>
      )}

      {activeTab === 'storage' && settings && (
        <div className="deployment-panel">
          <label>
            Default Storage Provider
            <select value={settings.storage?.default || 'local'} onChange={e => updateStorageDefault(e.target.value)}>
              {(providers?.fileStorageProviders || []).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <p className="deployment-hint">
            Credentials are stored on this server and never sent back to the browser —
            saved values show as dots. Leave a dotted field untouched to keep it.
          </p>

          {settings.storage?.default === 's3' && (
            <div className="deployment-subsection">
              <h4>S3 / MinIO</h4>
              <div className="g2">
                <label>Bucket<input value={s3().bucket || ''} onChange={e => setStorage('s3', 'bucket', e.target.value)} placeholder="my-attachments" /></label>
                <label>Region<input value={s3().region || ''} onChange={e => setStorage('s3', 'region', e.target.value)} placeholder="us-east-1" /></label>
                <label>Access key ID<input value={s3().accessKeyId || ''} onChange={e => setStorage('s3', 'accessKeyId', e.target.value)} autoComplete="off" /></label>
                <label>Secret access key<input type="password" value={s3().secretAccessKey || ''} onChange={e => setStorage('s3', 'secretAccessKey', e.target.value)} autoComplete="new-password" /></label>
                <label>Endpoint (MinIO only)<input value={s3().endpoint || ''} onChange={e => setStorage('s3', 'endpoint', e.target.value)} placeholder="https://minio.example.com" /></label>
                <label>Folder<input value={s3().baseFolder || ''} onChange={e => setStorage('s3', 'baseFolder', e.target.value)} placeholder="attachments" /></label>
              </div>
            </div>
          )}

          {settings.storage?.default === 'azure' && (
            <div className="deployment-subsection">
              <h4>Azure Blob Storage</h4>
              <label>Connection string<input type="password" value={az().connectionString || ''} onChange={e => setStorage('azure', 'connectionString', e.target.value)} placeholder="BlobEndpoint=https://….blob.core.windows.net/;SharedAccessSignature=…" autoComplete="new-password" /></label>
              <div className="g2">
                <label>Container<input value={az().containerName || ''} onChange={e => setStorage('azure', 'containerName', e.target.value)} placeholder="mertis" /></label>
                <label>Folder<input value={az().baseFolder || ''} onChange={e => setStorage('azure', 'baseFolder', e.target.value)} placeholder="attachments" /></label>
              </div>
            </div>
          )}

          {settings.storage?.default === 'sharepoint' && (
            <div className="deployment-subsection">
              <h4>SharePoint</h4>
              <div className="g2">
                <label>Tenant ID<input value={sp().tenantId || ''} onChange={e => setStorage('sharepoint', 'tenantId', e.target.value)} autoComplete="off" /></label>
                <label>Client ID<input value={sp().clientId || ''} onChange={e => setStorage('sharepoint', 'clientId', e.target.value)} autoComplete="off" /></label>
                <label>Client secret<input type="password" value={sp().clientSecret || ''} onChange={e => setStorage('sharepoint', 'clientSecret', e.target.value)} autoComplete="new-password" /></label>
                <label>Site name<input value={sp().siteName || ''} onChange={e => setStorage('sharepoint', 'siteName', e.target.value)} /></label>
                <label>Domain<input value={sp().domain || ''} onChange={e => setStorage('sharepoint', 'domain', e.target.value)} placeholder="contoso.sharepoint.com" /></label>
                <label>Folder<input value={sp().baseFolder || ''} onChange={e => setStorage('sharepoint', 'baseFolder', e.target.value)} placeholder="Mertis/attachments" /></label>
              </div>
            </div>
          )}
          <p><strong>Active providers:</strong> {(status?.storage?.providers || []).join(', ')}</p>
          <button type="button" className="btn-test" onClick={testStorage} disabled={testing === 'storage'}>
            {testing === 'storage' ? 'Testing…' : 'Test Storage (upload probe)'}
          </button>
        </div>
      )}

      {activeTab === 'ai' && settings && (
        <div className="deployment-panel">
          <p className="deployment-hint">
            AI features use <strong>your own</strong> API key. Mertis ships without one, never
            proxies your requests, and sends nothing to Turnera Tech. Leave this empty and AI
            features fall back to computed summaries.
          </p>

          <label>
            OpenAI API key
            <input
              type="password"
              value={settings.ai?.apiKey || ''}
              onChange={e => setAi('apiKey', e.target.value)}
              placeholder={settings.ai?.configured ? '' : 'sk-…'}
              autoComplete="new-password"
            />
          </label>
          {settings.ai?.configured && (
            <p className="deployment-hint">
              A key is configured{settings.ai?.hint ? <> (ending <code>{settings.ai.hint}</code>)</> : null}
              {settings.ai?.fromEnv ? ' from the server environment' : ''}.
              Type a new one to replace it, or clear the field and save to remove it.
            </p>
          )}

          <div className="g2">
            <label>
              Model
              <input value={settings.ai?.model || ''} onChange={e => setAi('model', e.target.value)} placeholder="gpt-4o-mini" />
            </label>
            <label>
              Base URL (self-hosted or compatible provider)
              <input value={settings.ai?.baseUrl || ''} onChange={e => setAi('baseUrl', e.target.value)} placeholder="https://api.openai.com/v1" />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'webhooks' && settings && (
        <div className="deployment-panel">
          <p className="deployment-hint">
            Push bug and project events to your own systems (Zapier, n8n, custom ETL, external databases).
            Payloads are signed with <code>X-Mertis-Signature</code> when WEBHOOK_SECRET is set.
          </p>
          {(settings.webhooks || []).map((wh, i) => (
            <div key={wh.id || i} className="webhook-row">
              <input placeholder="Name" value={wh.name} onChange={e => updateWebhook(i, 'name', e.target.value)} />
              <input placeholder="https://your-api.example/webhook" value={wh.url} onChange={e => updateWebhook(i, 'url', e.target.value)} />
              <input placeholder="Secret (optional)" type="password" value={wh.secret || ''} onChange={e => updateWebhook(i, 'secret', e.target.value)} />
              <label className="webhook-enabled">
                <input type="checkbox" checked={wh.enabled !== false} onChange={e => updateWebhook(i, 'enabled', e.target.checked)} />
                Enabled
              </label>
              <button type="button" className="btn-test-sm" onClick={() => testWebhook(wh.url, wh.secret)}>Test</button>
              <button type="button" className="btn-remove" onClick={() => removeWebhook(i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn-add" onClick={addWebhook}>+ Add Webhook</button>
          <p className="deployment-hint">Events: {(providers?.webhookEvents || []).join(', ')}</p>
        </div>
      )}

      {activeTab === 'license' && (
        <div className="deployment-panel">
          <div className="deployment-cards">
            <div className="deployment-card">
              <h3>Current Plan</h3>
              <p><strong>Tier:</strong> {license.tier}</p>
              <p><strong>Status:</strong> {license.status}</p>
              {license.company && <p><strong>Licensed to:</strong> {license.company}</p>}
              {license.expiresAt && <p><strong>Expires:</strong> {new Date(license.expiresAt).toLocaleDateString()}</p>}
            </div>
            {licenseLimits && (
              <div className="deployment-card">
                <h3>Usage</h3>
                <p>Users: {licenseLimits.users?.current ?? '—'} / {licenseLimits.users?.max ?? '∞'}</p>
                <p>Projects: {licenseLimits.projects?.current ?? '—'} / {licenseLimits.projects?.max ?? '∞'}</p>
              </div>
            )}
          </div>
          <label>
            Activate licence key
            <textarea
              rows={3}
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              placeholder="TT-XXXX-XXXX-XXXX-XXXX"
              spellCheck={false}
            />
          </label>
          <div className="deployment-actions" style={{ marginTop: '1rem', paddingTop: 0, borderTop: 'none' }}>
            <button type="button" className="btn-save" onClick={handleActivateLicense} disabled={activating}>
              {activating ? 'Activating…' : 'Activate License'}
            </button>
            <button type="button" className="btn-remove" onClick={handleReleaseLicense}>
              Release this install
            </button>
            {license.tier !== 'community' && (
              <button type="button" className="btn-remove" onClick={handleDeactivateLicense}>
                Revert to Community
              </button>
            )}
          </div>
          <p className="deployment-hint">
            Paste the <code>TT-</code> key from your registration email, or a signed licence token
            (<code>eyJ…</code>) if this server has no internet access.
          </p>
          <p className="deployment-hint">
            A key binds to one installation. <strong>Release this install</strong> unbinds it at the
            licence server so you can activate the same key elsewhere.
          </p>
          <p className="deployment-hint">
            Community Edition: 5 users, 3 projects, 250 bugs. Paid tiers unlock AI, advanced reporting and larger limits.
          </p>
        </div>
      )}

      {activeTab === 'plugins' && (
        <div className="deployment-panel">
          <p className="deployment-hint">
            Drop <code>.js</code> files in <code>server/plugins/</code> exporting <code>{'{ name, onEvent(event, data) }'}</code>.
          </p>
          {plugins.length === 0 ? (
            <p>No plugins loaded (example: server/plugins/example.plugin.js)</p>
          ) : (
            <ul className="plugin-list">
              {plugins.map(p => (
                <li key={p.name}><strong>{p.name}</strong>{p.description ? ` — ${p.description}` : ''}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(isGodmode || user?.role === 'admin') && activeTab !== 'license' && (
        <div className="deployment-actions">
          <button type="button" className="btn-save" onClick={saveSettings}>Save Deployment Settings</button>
          <span className="deployment-hint">Database changes require a server restart.</span>
        </div>
      )}
    </div>
  );
}

export default DeploymentConfig;
