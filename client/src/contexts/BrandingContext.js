import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FALLBACK_ORGANIZATION_NAME } from '../config/branding';

export const BrandingContext = createContext(null);

export function BrandingProvider({ children }) {
  const [organizationName, setOrganizationName] = useState(FALLBACK_ORGANIZATION_NAME);
  const [configured, setConfigured] = useState(false);

  const refreshBranding = useCallback(async () => {
    try {
      const res = await axios.get('/api/branding');
      const name = (res.data?.organizationName || '').trim();
      setOrganizationName(name || FALLBACK_ORGANIZATION_NAME);
      setConfigured(res.data?.configured === true);
    } catch {
      setOrganizationName(FALLBACK_ORGANIZATION_NAME);
      setConfigured(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  return (
    <BrandingContext.Provider value={{ organizationName, configured, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
