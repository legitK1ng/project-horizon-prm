export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'warning';
    method: string;
    url: string;
    message: string;
    details?: any;
}

type Listener = (logs: LogEntry[]) => void;

class ConnectionLogger {
    private logs: LogEntry[] = [];
    private listeners: Listener[] = [];
    private maxLogs = 50;

    getLogs() {
        return this.logs;
    }

    addLog(type: LogEntry['type'], method: string, url: string, message: string, details?: any) {
        const entry: LogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            type,
            method,
            url,
            message,
            details
        };

        this.logs = [entry, ...this.logs].slice(0, this.maxLogs);
        this.notifyListeners();
    }

    clear() {
        this.logs = [];
        this.notifyListeners();
    }

    subscribe(listener: Listener) {
        this.listeners.push(listener);
        listener(this.logs);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.logs));
    }
}

export const connectionLogger = new ConnectionLogger();
