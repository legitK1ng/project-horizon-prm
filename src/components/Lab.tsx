import React, { useState } from 'react';
import { CallRecord, Persona } from '@/types';
import { BRAIN_PERSONAS, ICONS } from '@/constants';
import { Brain, Play, RefreshCw, Save } from 'lucide-react';
import { generateId } from '@/utils/helpers';

interface LabProps {
    onSaveLog?: (call: CallRecord) => void;
}

const Lab: React.FC<LabProps> = ({ onSaveLog }) => {
    const [transcript, setTranscript] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedPersona, setSelectedPersona] = useState<Persona['id']>(BRAIN_PERSONAS[0].id);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<CallRecord['executiveBrief'] | null>(null);

    const handleProcess = async () => {
        if (!transcript.trim()) return;

        setIsProcessing(true);
        setResult(null);

        // Simulate AI processing delay
        setTimeout(() => {
            setResult({
                title: 'Strategic Brief',
                summary: "Executive brief generated from the manual transcript.",
                actionItems: ["Follow up with the client", "Schedule a review meeting"],
                tags: ["manual-entry", "review"],
                sentiment: "Neutral"
            });
            setIsProcessing(false);
        }, 2000);
    };

    const handleSave = () => {
        if (result && onSaveLog) {
            const newCall: CallRecord = {
                id: generateId('call'),
                timestamp: new Date().toISOString(),
                contactName: 'Manual Entry', // Backend will resolve this if phone matches
                phoneNumber: phoneNumber,
                duration: 0,
                transcript: transcript,
                status: 'COMPLETED',
                executiveBrief: result
            };
            onSaveLog(newCall);
            // Reset
            setTranscript('');
            setPhoneNumber('');
            setResult(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Processing Lab</h2>
                <p className="text-slate-500 dark:text-slate-400">Test AI analysis with different personas.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Column */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Phone Number (Optional)
                            </label>
                            <input
                                type="text"
                                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                placeholder="e.g. 555-0123"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                        </div>

                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Raw Call Transcript
                        </label>
                        <textarea
                            className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
                            placeholder="Paste transcript here..."
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                        />

                        <div className="mt-4 flex flex-wrap gap-2">
                            {BRAIN_PERSONAS.map(persona => (
                                <button
                                    key={persona.id}
                                    onClick={() => setSelectedPersona(persona.id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedPersona === persona.id
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                        }`}
                                >
                                    {persona.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleProcess}
                            disabled={isProcessing || !transcript.trim()}
                            className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw className="animate-spin" size={20} />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Brain size={20} />
                                    Analyze Text
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Output Column */}
                <div className="space-y-4">
                    {result ? (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    {ICONS.Dashboard} Analysis Results
                                </h3>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Save size={16} />
                                    Save to Logs
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                    <h4 className="font-semibold text-emerald-800 dark:text-emerald-400 mb-1 text-sm uppercase">Summary</h4>
                                    <p className="text-slate-700 dark:text-slate-300">{result.summary}</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 text-sm uppercase">Action Items</h4>
                                    <ul className="space-y-2">
                                        {result.actionItems.map((item: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                <div className="min-w-[4px] h-[4px] rounded-full bg-blue-500 mt-2" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 h-full flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <Play size={24} className="ml-1 opacity-50" />
                            </div>
                            <p>Ready to analyze.</p>
                            <p className="text-xs mt-1">Select a persona and click Analyze.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Lab;
