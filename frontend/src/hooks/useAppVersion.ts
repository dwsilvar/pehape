import { useEffect, useState } from 'react';

interface AppVersion {
  version: string;
  build_date: string;
  changelog: string;
  min_base_version: string;
}

/**
 * Loads version info from /api/settings/version (which serves version.json).
 */
export function useAppVersion(): AppVersion | null {
  const [version, setVersion] = useState<AppVersion | null>(null);

  useEffect(() => {
    fetch('/api/settings/version')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.version) setVersion(data); })
      .catch((err) => {
        console.error('Error fetching application version:', err);
      });
  }, []);

  return version;
}
