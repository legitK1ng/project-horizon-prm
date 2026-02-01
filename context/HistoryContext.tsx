
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { HistoryItem } from '../types';

interface HistoryContextType {
  history: HistoryItem[];
  addHistoryItem: (label: string, description: string, onRevert?: () => void) => void;
  togglePin: (id: string) => void;
  revertAction: (id: string) => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 'init-1',
      timestamp: new Date(Date.now() - 100000).toISOString(),
      label: 'System Initialization',
      description: 'Project Horizon PRM initialized v1.0.4',
      pinned: true,
      revertable: false
    }
  ]);

  const addHistoryItem = (label: string, description: string, onRevert?: () => void) => {
    const newItem: HistoryItem = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      label,
      description,
      pinned: false,
      revertable: !!onRevert,
      onRevert
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const togglePin = (id: string) => {
    setHistory(prev => prev.map(item => 
      item.id === id ? { ...item, pinned: !item.pinned } : item
    ));
  };

  const revertAction = (id: string) => {
    const item = history.find(i => i.id === id);
    if (item && item.onRevert) {
      item.onRevert();
      // Add a log for the revert itself
      addHistoryItem(`Reverted: ${item.label}`, `Undid action ${id}`);
    }
  };

  return (
    <HistoryContext.Provider value={{ history, addHistoryItem, togglePin, revertAction }}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};
