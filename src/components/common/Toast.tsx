import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
    toast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => { } });

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
        const id = `toast-${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const icons = {
        success: <Check size={16} className="text-emerald-500" />,
        error: <AlertCircle size={16} className="text-rose-500" />,
        info: <Info size={16} className="text-blue-500" />,
    };

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 animate-in slide-in-from-bottom-3 fade-in duration-300 min-w-[260px]"
                    >
                        {icons[t.type]}
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{t.message}</span>
                        <button
                            onClick={() => removeToast(t.id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
