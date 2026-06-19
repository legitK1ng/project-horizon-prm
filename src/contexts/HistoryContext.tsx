import React, { createContext, useContext, useReducer, ReactNode, useCallback, useEffect } from 'react';
import { HistoryItem } from '@/types';
import { generateId } from '@/utils/helpers';

interface HistoryContextValue {
  history: HistoryItem[];
  addHistoryItem: (label: string, description: string, onRevert?: () => Promise<void> | void) => void;
  togglePin: (id: string) => void;
  revertAction: (id: string) => Promise<void>;
  clearHistory: () => void;
  isReverting: string | null; // ID of the action currently being reverted
}

// Action Types
type HistoryAction =
  | { type: 'ADD_ITEM'; payload: HistoryItem }
  | { type: 'TOGGLE_PIN'; payload: string }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_REVERTING'; payload: string | null }
  | { type: 'SET_HISTORY'; payload: HistoryItem[] };

// Initial State Profile
const INITIAL_HISTORY: HistoryItem[] = [
  {
    id: 'init-1',
    timestamp: new Date().toISOString(),
    label: 'System Initialization',
    description: 'Project Horizon PRM initialized (Enterprise Build)',
    pinned: true,
    revertable: false,
  },
];

interface HistoryState {
  items: HistoryItem[];
  revertingId: string | null;
}

const initialState: HistoryState = {
  items: INITIAL_HISTORY,
  revertingId: null
};

// Reducer Function
function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [action.payload, ...state.items] };
    case 'TOGGLE_PIN':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload ? { ...item, pinned: !item.pinned } : item
        ),
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
    case 'CLEAR_HISTORY':
      return { ...state, items: INITIAL_HISTORY };
    case 'SET_REVERTING':
      return { ...state, revertingId: action.payload };
    case 'SET_HISTORY':
      return { ...state, items: action.payload };
    default:
      return state;
  }
}

const HistoryContext = createContext<HistoryContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'horizon_history_state';

export const HistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(historyReducer, initialState, (initial) => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Rehydrate dates, note that functions (onRevert) are lost in JSON serialization,
        // so persistent history can't easily maintain functional references.
        return { items: parsed, revertingId: null };
      }
    } catch (e) {
      console.error("Failed to parse history from local storage", e);
    }
    return initial;
  });

  // Sync with Local Storage (excluding functional properties safely)
  useEffect(() => {
    try {
      const serializableItems = state.items.map(item => ({
        ...item,
        onRevert: undefined // Cannot serialize functions
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializableItems));
    } catch (e) {
      console.error("Failed to save history to local storage", e);
    }
  }, [state.items]);

  const addHistoryItem = useCallback(
    (label: string, description: string, onRevert?: () => Promise<void> | void) => {
      const newItem: HistoryItem = {
        id: generateId('action'),
        timestamp: new Date().toISOString(),
        label,
        description,
        pinned: false,
        revertable: !!onRevert,
        onRevert,
      };
      dispatch({ type: 'ADD_ITEM', payload: newItem });
    },
    []
  );

  const togglePin = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_PIN', payload: id });
  }, []);

  const revertAction = useCallback(
    async (id: string) => {
      const item = state.items.find((i) => i.id === id);

      if (item?.onRevert) {
        dispatch({ type: 'SET_REVERTING', payload: id });
        try {
          await Promise.resolve(item.onRevert());
          dispatch({
            type: 'ADD_ITEM', payload: {
              id: generateId('action'),
              timestamp: new Date().toISOString(),
              label: `Reverted: ${item.label}`,
              description: `Successfully undid action: ${id}`,
              pinned: false,
              revertable: false
            }
          });
          // Optionally remove the reverted item or tag it as reverted
          // dispatch({ type: 'REMOVE_ITEM', payload: id });
        } catch (error) {
          console.error(`Error reverting action ${id}:`, error);
          dispatch({
            type: 'ADD_ITEM', payload: {
              id: generateId('error'),
              timestamp: new Date().toISOString(),
              label: `Revert Failed: ${item.label}`,
              description: `Error: ${error instanceof Error ? error.message : 'Unknown network failure'}`,
              pinned: true, // Pin errors so the user sees them
              revertable: false
            }
          });
        } finally {
          dispatch({ type: 'SET_REVERTING', payload: null });
        }
      }
    },
    [state.items]
  );

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  const value: HistoryContextValue = {
    history: state.items,
    isReverting: state.revertingId,
    addHistoryItem,
    togglePin,
    revertAction,
    clearHistory,
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useHistory = (): HistoryContextValue => {
  const context = useContext(HistoryContext);

  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }

  return context;
};
