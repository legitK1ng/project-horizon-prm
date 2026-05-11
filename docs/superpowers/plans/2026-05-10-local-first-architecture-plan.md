# Local-First Architecture & Infinite Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the frontend data layer to a local-first architecture using Dexie.js (IndexedDB) for zero-latency reads, and implement infinite scrolling virtualization using `@tanstack/react-virtual` for performance.

**Architecture:** We will set up Dexie as a local cache mirroring Supabase tables. A background sync service will eagerly fetch data and listen for realtime updates. UI components will read exclusively from Dexie using `useLiveQuery` and render items efficiently using virtualization.

**Tech Stack:** React, Dexie.js, `@tanstack/react-virtual`, Supabase.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the required libraries**

```bash
npm install dexie dexie-react-hooks @tanstack/react-virtual
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install dexie and react-virtual dependencies"
```

---

### Task 2: Define Dexie Database Schema

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Create the Dexie database class**

Create the file `src/lib/db.ts`:
```typescript
import Dexie, { Table } from 'dexie';
import { Contact, CallRecord, Task } from '../types';

export class HorizonDB extends Dexie {
    contacts!: Table<Contact, string>;
    call_records!: Table<CallRecord, string>;
    tasks!: Table<Task, string>;

    constructor() {
        super('HorizonDB');
        this.version(1).stores({
            contacts: 'id, last_synced',
            call_records: 'id, contact_id, timestamp',
            tasks: 'id, status, due_date'
        });
    }
}

export const db = new HorizonDB();
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: initialize Dexie database schema for local-first architecture"
```

---

### Task 3: Create Sync Engine Service

**Files:**
- Create: `src/services/syncService.ts`

- [ ] **Step 1: Implement the bulk fetch and real-time listeners**

Create the file `src/services/syncService.ts`:
```typescript
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';

export class SyncService {
    static async initialSync() {
        try {
            // Fetch contacts
            const { data: contacts } = await supabase.from('contacts').select('*');
            if (contacts) await db.contacts.bulkPut(contacts);

            // Fetch call records
            const { data: calls } = await supabase.from('call_records').select('*');
            if (calls) await db.call_records.bulkPut(calls);
            
            // Fetch tasks
            const { data: tasks } = await supabase.from('tasks').select('*');
            if (tasks) await db.tasks.bulkPut(tasks);

            console.log('Initial sync complete.');
        } catch (error) {
            console.error('Error during initial sync:', error);
        }
    }

    static subscribeToUpdates() {
        supabase.channel('public:contacts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, async (payload) => {
                if (payload.eventType === 'DELETE') {
                    await db.contacts.delete(payload.old.id);
                } else {
                    await db.contacts.put(payload.new as any);
                }
            }).subscribe();

        supabase.channel('public:call_records')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'call_records' }, async (payload) => {
                if (payload.eventType === 'DELETE') {
                    await db.call_records.delete(payload.old.id);
                } else {
                    await db.call_records.put(payload.new as any);
                }
            }).subscribe();
    }

    static start() {
        this.initialSync().then(() => {
            this.subscribeToUpdates();
        });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/syncService.ts
git commit -m "feat: create sync service to bridge Supabase and Dexie"
```

---

### Task 4: Integrate Sync Engine into App Lifecycle

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Initialize SyncService in App.tsx**

Modify `src/App.tsx` to import and start the `SyncService` inside the main `App` or `AppContent` initialization effect.

Look for a suitable initialization `useEffect` and add:
```typescript
import { SyncService } from './services/syncService';

// Inside App component or AppContent useEffect:
useEffect(() => {
    // start background sync
    SyncService.start();
    // ... existing init logic ...
}, []);
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: initialize SyncService on application startup"
```

---

### Task 5: Refactor ContactList for Virtualization and Dexie

**Files:**
- Modify: `src/components/ContactList.tsx`

- [ ] **Step 1: Replace Supabase queries with Dexie `useLiveQuery` and add `@tanstack/react-virtual`**

Modify `src/components/ContactList.tsx`:
- Import `useLiveQuery` from `dexie-react-hooks`.
- Import `db` from `../lib/db`.
- Import `useVirtualizer` from `@tanstack/react-virtual`.
- Replace the data fetching logic with `const contacts = useLiveQuery(() => db.contacts.toArray()) || [];`
- Wrap the scroll container with `useVirtualizer`.

Example of the core virtualization wrapper:
```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

// Inside ContactList component
const contacts = useLiveQuery(() => db.contacts.toArray()) || [];
const parentRef = useRef<HTMLDivElement>(null);

const rowVirtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // estimated height of contact card
    overscan: 5,
});

// Render logic replacing the standard map:
<div ref={parentRef} className="h-full overflow-y-auto w-full">
    <div
        style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
        }}
    >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const contact = contacts[virtualRow.index];
            return (
                <div
                    key={virtualRow.key}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                    }}
                >
                    <ContactCard contact={contact} />
                </div>
            );
        })}
    </div>
</div>
```
*(Adapt to exact existing component naming/structure)*

- [ ] **Step 2: Commit**

```bash
git add src/components/ContactList.tsx
git commit -m "refactor: transition ContactList to Dexie local DB and react-virtual infinite scroll"
```

---

### Task 6: Refactor CallLog for Virtualization and Dexie

**Files:**
- Modify: `src/components/CallLog.tsx`

- [ ] **Step 1: Replace data fetching and map logic with virtualization**

Similar to Task 5, modify `src/components/CallLog.tsx`:
- Fetch using `const callLogs = useLiveQuery(() => db.call_records.orderBy('timestamp').reverse().toArray()) || [];`
- Apply `useVirtualizer` with dynamic estimation since transcripts vary in size. Use `measureElement` ref on the rendered virtual item wrapper.

```tsx
const callLogs = useLiveQuery(() => db.call_records.orderBy('timestamp').reverse().toArray()) || [];
const parentRef = useRef<HTMLDivElement>(null);

const rowVirtualizer = useVirtualizer({
    count: callLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // rough estimate
    overscan: 5,
});

// Inside return mapping
<div ref={parentRef} className="h-full overflow-y-auto w-full">
    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const log = callLogs[virtualRow.index];
            return (
                <div
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                    }}
                >
                    <CallRecordCard record={log} />
                </div>
            );
        })}
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CallLog.tsx
git commit -m "refactor: transition CallLog to Dexie local DB and react-virtual dynamic height infinite scroll"
```
