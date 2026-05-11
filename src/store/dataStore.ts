import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Contact, CallRecord } from '@/types';

// Custom indexedDB storage for Zustand's persist middleware
// This allows caching thousands of records locally without exhausting localStorage
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface DataState {
  contacts: Contact[];
  callRecords: CallRecord[];
  lastContactsSync: string | null;
  lastCallsSync: string | null;
  isInitializing: boolean;
  
  setContacts: (contacts: Contact[]) => void;
  upsertContacts: (contacts: Contact[]) => void;
  
  setCallRecords: (calls: CallRecord[]) => void;
  upsertCallRecords: (calls: CallRecord[]) => void;
  
  clearCache: () => void;
  setIsInitializing: (isInit: boolean) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      contacts: [],
      callRecords: [],
      lastContactsSync: null,
      lastCallsSync: null,
      isInitializing: true, // Signals if hydration is complete

      setContacts: (contacts) => set({ contacts, lastContactsSync: new Date().toISOString() }),
      
      upsertContacts: (newContacts) => set((state) => {
        const contactMap = new Map(state.contacts.map(c => [c.id, c]));
        newContacts.forEach(c => contactMap.set(c.id, c));
        // Keep sorted or handle sorting on rendering side
        return { 
          contacts: Array.from(contactMap.values()), 
          lastContactsSync: new Date().toISOString() 
        };
      }),

      setCallRecords: (callRecords) => set({ callRecords, lastCallsSync: new Date().toISOString() }),
      
      upsertCallRecords: (newCalls) => set((state) => {
        const callMap = new Map(state.callRecords.map(c => [c.id, c]));
        newCalls.forEach(c => callMap.set(c.id, c));
        // Typically call records are sorted by timestamp
        const updatedCalls = Array.from(callMap.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return { 
          callRecords: updatedCalls, 
          lastCallsSync: new Date().toISOString() 
        };
      }),

      clearCache: () => set({ 
        contacts: [], 
        callRecords: [], 
        lastContactsSync: null, 
        lastCallsSync: null 
      }),
      
      setIsInitializing: (isInitializing) => set({ isInitializing }),
    }),
    {
      name: 'horizon-data-cache',
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setIsInitializing(false);
        }
      },
      partialize: (state) => ({
        contacts: state.contacts,
        callRecords: state.callRecords,
        lastContactsSync: state.lastContactsSync,
        lastCallsSync: state.lastCallsSync,
      }),
    }
  )
);
