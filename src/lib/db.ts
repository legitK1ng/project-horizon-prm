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
