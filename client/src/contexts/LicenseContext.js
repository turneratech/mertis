import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  LIMIT_WARNING_COPY,
  LIMIT_WARN_PCT,
  LIMIT_CRITICAL_PCT
} from '../config/tiers';

export const LicenseContext = createContext(null);

const COMMUNITY_FEATURES = ['basic_bug_tracking', 'project_management', 'github_integration_basic', 'export_data'];

const DEFAULT_LIMITS = {
  maxUsers: 5,
  maxProjects: 3,
  maxBugs: 250,
  maxAttachmentSizeMB: 5,
  aiRequestsPerMonth: 0,
  maxWebhooks: 1,
  maxInstances: 1
};

const DEFAULT_USAGE = {
  users: { allowed: true, current: null, max: null },
  projects: { allowed: true, current: null, max: null },
  bugs: { allowed: true, current: null, max: null }
};

const DEFAULT_STATE = {
  tier: 'community',
  status: 'active',
  valid: true,
  features: COMMUNITY_FEATURES,
  limits: DEFAULT_LIMITS,
  featureMap: {},
  licensee: null,
  company: null,
  expiresAt: null,
  isTrial: false,
  isGracePeriod: false,
  loading: true,
  error: null
};

export function LicenseProvider({ children }) {
  const [license, setLicense] = useState(DEFAULT_STATE);
  const [usage, setUsage] = useState(DEFAULT_USAGE);
  const [upgradePrompt, setUpgradePrompt] = useState({ open: false, feature: null });
  const intervalRef = useRef(null);

  const fetchLicenseStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/license/status');
      setLicense(prev => ({ ...prev, ...res.data, loading: false, error: null }));
    } catch (err) {
      setLicense(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  const fetchLicenseLimits = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get('/api/license/limits');
      setUsage(res.data);
    } catch (_) {
      // Unauthenticated or unavailable — keep prior usage
    }
  }, []);

  const refreshLicense = useCallback(async () => {
    await Promise.all([fetchLicenseStatus(), fetchLicenseLimits()]);
  }, [fetchLicenseStatus, fetchLicenseLimits]);

  useEffect(() => {
    refreshLicense();
    intervalRef.current = setInterval(refreshLicense, 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [refreshLicense]);

  const hasFeature = useCallback((featureName) => {
    if (license.featureMap && featureName in license.featureMap) {
      return license.featureMap[featureName];
    }
    return Array.isArray(license.features) && license.features.includes(featureName);
  }, [license]);

  const getLimitInfo = useCallback((limitType) => {
    const item = usage[limitType];
    if (item && item.max !== null && item.max !== undefined) {
      return { current: item.current, max: item.max, allowed: item.allowed };
    }
    const keyMap = { users: 'maxUsers', projects: 'maxProjects', bugs: 'maxBugs' };
    const max = license.limits?.[keyMap[limitType]] ?? null;
    return { current: item?.current ?? null, max, allowed: item?.allowed ?? true };
  }, [usage, license]);

  const isAtLimit = useCallback((limitType) => {
    const info = getLimitInfo(limitType);
    if (info.max === null || info.max === undefined) return false;
    return !info.allowed || (info.current !== null && info.current >= info.max);
  }, [getLimitInfo]);

  const checkLimit = useCallback((limitType) => getLimitInfo(limitType), [getLimitInfo]);

  /**
   * How close a limit is, so the UI can warn before the wall rather than after.
   *
   * Community users previously got no signal at all — bugs had no counter, and
   * the first thing anyone saw was a 403 at 250/250.
   *
   * Returns null when there is nothing to say: unlimited tier, usage not loaded
   * yet, or still comfortably inside the limit.
   */
  const getLimitWarning = useCallback((limitType) => {
    const { current, max } = getLimitInfo(limitType);
    if (max === null || max === undefined || current === null || current === undefined) return null;
    if (max <= 0) return null;

    const pct = current / max;
    if (pct < LIMIT_WARN_PCT) return null;

    const remaining = Math.max(max - current, 0);
    return {
      level: remaining === 0 ? 'reached' : (pct >= LIMIT_CRITICAL_PCT ? 'critical' : 'warning'),
      remaining,
      current,
      max,
      message: LIMIT_WARNING_COPY[limitType]
        ? LIMIT_WARNING_COPY[limitType](remaining)
        : `${remaining} of ${max} left on your plan`
    };
  }, [getLimitInfo]);

  const activateLicense = useCallback(async (licenseKey) => {
    const res = await axios.post('/api/license/activate', { licenseKey });
    await refreshLicense();
    return res.data;
  }, [refreshLicense]);

  const promptUpgrade = useCallback((featureName) => {
    setUpgradePrompt({ open: true, feature: featureName, limit: null });
  }, []);

  // Count limits need their own entry point: they are not features, and
  // describing them as one is how every limit-reached button ended up telling
  // the user about Priority Support.
  const promptLimitUpgrade = useCallback((limitType) => {
    setUpgradePrompt({ open: true, feature: null, limit: limitType });
  }, []);

  const closeUpgradePrompt = useCallback(() => {
    setUpgradePrompt({ open: false, feature: null, limit: null });
  }, []);

  return (
    <LicenseContext.Provider value={{
      license,
      usage,
      hasFeature,
      checkLimit,
      getLimitInfo,
      isAtLimit,
      activateLicense,
      promptUpgrade,
      promptLimitUpgrade,
      getLimitWarning,
      closeUpgradePrompt,
      upgradePrompt,
      refreshLicense
    }}>
      {children}
    </LicenseContext.Provider>
  );
}
