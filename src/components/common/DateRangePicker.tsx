import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRange {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
}

interface DateRangePickerProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasValue = value.start || value.end;

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange({ start: '', end: '' });
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${hasValue || isOpen
                    ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                title="Filter by Date Range"
            >
                <Calendar size={18} />
                {hasValue && (
                    <span className="text-xs font-medium">
                        {value.start ? new Date(value.start).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : '...'}
                        {' - '}
                        {value.end ? new Date(value.end).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : '...'}
                    </span>
                )}
                {hasValue && (
                    <div onClick={handleClear} className="hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full p-0.5 ml-1">
                        <X size={12} />
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 p-4 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-72 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Start Date</label>
                            <input
                                type="date"
                                aria-label="Start Date"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                value={value.start}
                                onChange={(e) => onChange({ ...value, start: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1">End Date</label>
                            <input
                                type="date"
                                aria-label="End Date"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                value={value.end}
                                onChange={(e) => onChange({ ...value, end: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
