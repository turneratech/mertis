import { useEffect, useState } from 'react';
import { useFeature } from '../hooks/useFeature';
import { fetchPulseStatus } from './pulseApi';

/** null while loading; false when Pulse or project_management is off. */
export function usePulseEnabled() {
  const { isAvailable } = useFeature('project_management');
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    if (!isAvailable) {
      setEnabled(false);
      return undefined;
    }
    fetchPulseStatus()
      .then((status) => setEnabled(status.enabled !== false))
      .catch(() => setEnabled(false));
    return undefined;
  }, [isAvailable]);

  return enabled;
}
