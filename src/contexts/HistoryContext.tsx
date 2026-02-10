import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { HistoryItem } from '@/types';
import { generateId } from '@/utils/helpers';

interface HistoryContextValue {
  history: HistoryItem[];
  addHistoryItem: (label: string, description: string, onRevert?: () => void) => void;
  togglePin: (id: string) => void;
  revertAction: (id: string) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextValue | undefined>(undefined);

const INITIAL_HISTORY: HistoryItem[] = [
  {
    id: 'init-1',
    timestamp: new Date(Date.now() - 100000).toISOString(),
    label: 'System Initialization',
    description: 'Project Horizon PRM initialized v1.0.0',
    pinned: true,
    revertable: false,
  },
];

export const HistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<HistoryItem[]>(INITIAL_HISTORY);

  const addHistoryItem = useCallback(
    (label: string, description: string, onRevert?: () => void) => {
      const newItem: HistoryItem = {
        id: generateId('action'),
        timestamp: new Date().toISOString(),
        label,
        description,
        pinned: false,
        revertable: !!onRevert,
        onRevert,
      };

      setHistory((prev) => [newItem, ...prev]);
    },
    []
  );

  const togglePin = useCallback((id: string) => {
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
    );
  }, []);

  const revertAction = useCallback(
    (id: string) => {
      const item = history.find((i) => i.id === id);

      if (item?.onRevert) {
        item.onRevert();
        addHistoryItem(`Reverted: ${item.label}`, `Undid action ${id}`);
      }
    },
    [history, addHistoryItem]
  );

  const clearHistory = useCallback(() => {
    setHistory(INITIAL_HISTORY);
  }, []);

  const value: HistoryContextValue = {
    history,
    addHistoryItem,
    togglePin,
    revertAction,
    clearHistory,
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
};

export const useHistory = (): HistoryContextValue => {
  const context = useContext(HistoryContext);

  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }

  return context;
};
