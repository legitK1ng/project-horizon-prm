import { useState, useEffect, useCallback } from 'react';
import { CallRecord, Contact, ConnectionStatus } from '@/types';
import { fetchProjectHorizonData, postCallData } from '@/services/apiService';
import { MOCK_CALLS, MOCK_CONTACTS } from '@/services/mockData';
import { APP_CONFIG } from '@/constants';
import { parseJSON } from '@/utils/helpers';

interface UseDataReturn {
  calls: CallRecord[];
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  refreshData: () => Promise<void>;
  addCall: (call: CallRecord) => void;
  updateCalls: (calls: CallRecord[]) => void;
}

export const useData = (): UseDataReturn => {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('offline');

  const loadMocksOrCached = useCallback(() => {
    const savedCalls = localStorage.getItem(APP_CONFIG.localStorage.callsKey);

    if (savedCalls) {
      const parsed = parseJSON<CallRecord[]>(savedCalls, MOCK_CALLS);
      setCalls(parsed);
      setContacts(MOCK_CONTACTS);
    } else {
      setCalls(MOCK_CALLS);
      setContacts(MOCK_CONTACTS);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchProjectHorizonData();

      if (data) {
        setCalls(data.calls);
        setContacts(data.contacts);
        setConnectionStatus('connected');

        // Cache for offline use
        localStorage.setItem(APP_CONFIG.localStorage.callsKey, JSON.stringify(data.calls));
      } else {
        // API URL not configured - use mocks
        console.log('Using mock data (API not configured)');
        setConnectionStatus('offline');
        loadMocksOrCached();
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setConnectionStatus('offline');
      loadMocksOrCached();
    } finally {
      setIsLoading(false);
    }
  }, [loadMocksOrCached]);

  const addCall = useCallback(async (call: CallRecord) => {
    // Optimistic update - update UI immediately
    setCalls((prev) => {
      const updated = [call, ...prev];
      localStorage.setItem(APP_CONFIG.localStorage.callsKey, JSON.stringify(updated));
      return updated;
    });

    // Sync with backend
    try {
      const success = await postCallData(call);
      if (!success) {
        console.warn('Backend sync failed, data saved locally only');
        setError('Data saved locally. Cloud sync failed - check connection.');
      } else {
        setConnectionStatus('connected');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setError('Cloud sync error.');
    }
  }, []);

  const updateCalls = useCallback((newCalls: CallRecord[]) => {
    setCalls(newCalls);
    localStorage.setItem(APP_CONFIG.localStorage.callsKey, JSON.stringify(newCalls));
  }, []);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    calls,
    contacts,
    isLoading,
    error,
    connectionStatus,
    refreshData,
    addCall,
    updateCalls,
  };
};
