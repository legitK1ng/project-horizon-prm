import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { connectionLogger } from '../utils/connectionLogger';
import type { Contact, CallRecord } from '../types';

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

            connectionLogger.addLog('success', 'SYNC', 'SYSTEM', 'Initial sync complete');
        } catch (error) {
            connectionLogger.addLog('error', 'SYNC', 'SYSTEM', 'Initial sync failed', { error });
        }
    }

    static subscribeToUpdates() {
        supabase.channel('public:contacts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, async (payload) => {
                if (payload.eventType === 'DELETE') {
                    await db.contacts.delete(payload.old.id);
                } else {
                    await db.contacts.put(payload.new as Contact);
                }
            }).subscribe();

        supabase.channel('public:call_records')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'call_records' }, async (payload) => {
                if (payload.eventType === 'DELETE') {
                    await db.call_records.delete(payload.old.id);
                } else {
                    await db.call_records.put(payload.new as CallRecord);
                }
            }).subscribe();
    }

    static start() {
        this.initialSync().then(() => {
            this.subscribeToUpdates();
        });
    }
}
