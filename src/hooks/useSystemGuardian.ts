import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface SystemStatus {
  supabase: 'online' | 'offline' | 'degraded';
  network: 'online' | 'offline';
  latency: number;
  storageUsage: number;
  lastCheck: string;
}

export const useSystemGuardian = () => {
  const [status, setStatus] = useState<SystemStatus>({
    supabase: 'online',
    network: navigator.onLine ? 'online' : 'offline',
    latency: 0,
    storageUsage: 0,
    lastCheck: new Date().toISOString(),
  });

  const checkStatus = async () => {
    const startTime = performance.now();
    let supabaseStatus: SystemStatus['supabase'] = 'online';
    
    try {
      const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      if (error) throw error;
    } catch (err) {
      console.error('Guardian: Supabase check failed', err);
      supabaseStatus = 'offline';
    }

    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);

    // Calculate localStorage usage (rough estimate)
    let total = 0;
    for (let x in localStorage) {
      if (localStorage.hasOwnProperty(x)) {
        total += ((localStorage[x].length + x.length) * 2);
      }
    }
    const storageUsage = Math.round((total / (5 * 1024 * 1024)) * 100); // % of 5MB limit

    setStatus({
      supabase: supabaseStatus,
      network: navigator.onLine ? 'online' : 'offline',
      latency,
      storageUsage,
      lastCheck: new Date().toISOString(),
    });
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return { status, refresh: checkStatus };
};
