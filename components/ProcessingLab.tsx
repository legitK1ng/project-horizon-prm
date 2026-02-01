
import React, { useState } from 'react';
import { CallRecord, ExecutiveBrief } from '../types';
import { geminiService } from '../services/geminiService';
import { ICONS } from '../constants';
import { 
  FlaskConical, 
  Brain, 
  Wrench, 
  DollarSign, 
  List, 
  Settings, 
  FileText, 
  Upload, 
  Cpu,
  ChevronDown
} from 'lucide-react';
import { useHistory } from '../context/HistoryContext';

interface ProcessingLabProps {
  onProcessed: (call: CallRecord) => void;
}

type BrainType = 'consultant' | 'mobilemech' | 'finance' | 'straight' | 'system';

const ProcessingLab: React.FC<ProcessingLabProps> = ({ onProcessed }) => {
  const [selectedBrain, setSelectedBrain] = useState<BrainType>('consultant');
  const [systemContext, setSystemContext] = useState('');
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastBrief, setLastBrief] = useState<ExecutiveBrief | null>(null);
  const [error, setError] = useState('');
  const { addHistoryItem } = useHistory();

  const brains = [
    { id: 'consultant', label: 'Strategic Consultant', icon: <Brain size={18} />, desc: 'Standard executive briefing' },
    { id: 'mobilemech', label: 'MobileMech AI', icon: <Wrench size={18} />, desc: 'Technical quoting & diagnostics' },
    { id: 'finance', label: 'Financial Analyst', icon: <DollarSign size={18} />, desc: 'P&L and variance tables' },
    { id: 'straight', label: 'Straight Answer AI', icon: <List size={18} />, desc: 'Bullet-point facts only' },
    { id: 'system', label: 'System Change', icon: <Settings size={18} />, desc: 'Custom context injection' },
  ];

  const handleProcess = async () => {
    if (!rawText.trim()) {
      setError("Please provide input text to analyze.");
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      let brief: ExecutiveBrief;
      const cleaned = geminiService.cleanTranscript(rawText);

      // Simulation Logic Switch
      switch (selectedBrain) {
        case 'mobilemech':
          await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate think time
          brief = {
            title: 'MobileMech Estimate: Water Pump Replacement',
            summary: `**Quote Reference: #MM-492**\n\n| Item | Cost |\n| :--- | :--- |\n| Water Pump (OEM) | $145.00 |\n| Labor (2.5h) | $345.00 |\n| Coolant Flush | $25.00 |\n| Shop Supplies | $18.50 |\n| **TOTAL** | **$533.50** |`,
            actionItems: ['Approve estimate via SMS', 'Order parts from NAPA', 'Schedule installation window'],
            tags: ['#quote', '#repair', '#urgent', '#automotive']
          };
          break;

        case 'finance':
          await new Promise(resolve => setTimeout(resolve, 1500));
          brief = {
            title: 'Q3 P&L Variance Analysis',
            summary: `**Financial Overview: August 2024**\n\n| Category | Actual | Budget | Variance |\n| :--- | :--- | :--- | :--- |\n| Revenue | $1.2M | $1.0M | +$200k (20%) |\n| COGS | $400k | $350k | -$50k (-14%) |\n| OpEx | $300k | $300k | $0 (0%) |\n| **Net Income** | **$500k** | **$350k** | **+$150k** |`,
            actionItems: ['Investigate COGS increase in manufacturing', 'Reallocate surplus to marketing Q4', 'Prepare board slides'],
            tags: ['#finance', '#p&l', '#variance', '#Q3']
          };
          break;

        case 'straight':
          await new Promise(resolve => setTimeout(resolve, 1000));
          brief = {
            title: 'Fact Extraction: Key Details',
            summary: `1. Client requested immediate refund.\n2. Product delivered was model X-500, not X-600.\n3. Return policy allows 30-day window.\n4. Supervisor approval required for amounts > $500.`,
            actionItems: ['Process Refund #9921', 'Email return label'],
            tags: ['#facts', '#support', '#refund']
          };
          break;

        case 'system':
          await new Promise(resolve => setTimeout(resolve, 1200));
          brief = {
            title: 'Custom Analysis Result',
            summary: `**Applied System Context:**\n"${systemContext || 'No custom context provided'}"\n\n**Analysis Result:**\nSimulation complete based on user-defined system constraints. The AI has processed the input using the specific persona defined above.`,
            actionItems: ['Verify output against custom constraints', 'Refine system prompt if necessary'],
            tags: ['#system-change', '#custom-prompt', '#dev-mode']
          };
          break;

        case 'consultant':
        default:
          // Real AI Call
          brief = await geminiService.generateBrief(cleaned);
          break;
      }
      
      const newCall: CallRecord = {
        id: `sim-${Date.now()}`,
        timestamp: new Date().toISOString(),
        contactName: `Sim: ${brains.find(b => b.id === selectedBrain)?.label}`,
        phoneNumber: '000-000-0000',
        duration: '00:00',
        status: 'completed',
        rawTranscript: cleaned,
        executiveBrief: brief
      };

      setLastBrief(brief);
      onProcessed(newCall);
      addHistoryItem(
        'Processing Lab Simulation', 
        `Ran analysis using ${brains.find(b => b.id === selectedBrain)?.label}`
      );
      // setRawText(''); // Keep text for iterative testing
    } catch (e: any) {
      setError(e.message || "Failed to analyze transcript.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-500 max-w-5xl mx-auto pb-20">
      <header className="mb-10 text-center">
        <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-2 flex items-center justify-center gap-3">
          <span>Brain Simulation</span>
          <span className="text-3xl">🧠</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg">Manual Analysis & System Sandbox</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Column */}
        <div className="space-y-6">
          
          {/* 1. Brain Selector */}
          <div className="bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative">
              <select
                value={selectedBrain}
                onChange={(e) => setSelectedBrain(e.target.value as BrainType)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white pl-12 pr-10 py-4 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
              >
                {brains.map(b => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 pointer-events-none">
                {brains.find(b => b.id === selectedBrain)?.icon}
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown size={20} />
              </div>
            </div>
            <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Mode: {brains.find(b => b.id === selectedBrain)?.desc}
            </div>
          </div>

          {/* 2. System Context (Conditional) */}
          {selectedBrain === 'system' && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-300">
              <div className="relative bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border-2 border-orange-200 dark:border-orange-800/50">
                <div className="flex items-center gap-2 mb-2 text-orange-700 dark:text-orange-400 font-bold text-sm uppercase tracking-wider">
                  <Cpu size={14} />
                  System Context / Hidden Prompt
                </div>
                <textarea
                  value={systemContext}
                  onChange={(e) => setSystemContext(e.target.value)}
                  placeholder="Define the AI's role and constraints here (e.g., 'You are a poetic coding assistant...')"
                  className="w-full h-24 bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 dark:text-slate-200"
                />
              </div>
            </div>
          )}

          {/* 3. Input Zone */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-slate-400" />
                Input Data
              </label>
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                Text & OCR Supported
              </span>
            </div>
            
            <div className="flex-1 relative group">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste call transcript, notes, or JSON payload here..."
                className="w-full h-full p-4 bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-mono text-sm resize-none text-slate-900 dark:text-slate-300 z-10 relative"
              />
              {!rawText && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
                  <Upload size={32} className="mb-2 opacity-50" />
                  <span className="text-sm font-medium">Drag & Drop or Paste Text</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                disabled={isProcessing}
                onClick={handleProcess}
                className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                  isProcessing 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FlaskConical size={20} />
                    <span>Run Analysis</span>
                  </>
                )}
              </button>
              {error && (
                <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium flex items-center border border-rose-100 dark:border-rose-800">
                  <span className="mr-2">{ICONS.Error}</span>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div className="space-y-6">
          <div className={`bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col ${!lastBrief ? 'items-center justify-center opacity-60' : ''}`}>
            {lastBrief ? (
              <div className="animate-in zoom-in-95 duration-300 w-full">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 mb-6 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-1.5 rounded-full w-fit mx-auto md:mx-0">
                  {ICONS.Success}
                  <span className="text-xs font-bold uppercase tracking-wider">Analysis Complete</span>
                </div>
                
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">{lastBrief.title}</h3>
                
                {/* Summary / Table Renderer */}
                <div className="mb-8 bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText size={14} />
                    Executive Summary
                  </h4>
                  <div className="text-slate-700 dark:text-slate-300 leading-relaxed font-mono text-sm whitespace-pre-wrap">
                    {lastBrief.summary}
                  </div>
                </div>

                <div className="mb-8">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Strategic Action Items</h5>
                  <ul className="space-y-3">
                    {lastBrief.actionItems.map((item: string, i: number) => (
                      <li key={i} className="flex items-start group">
                        <span className="mr-3 text-blue-600 dark:text-blue-400 mt-0.5 transition-transform group-hover:scale-110">{ICONS.Action}</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  {lastBrief.tags.map((tag: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-default">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-600">
                  <FlaskConical size={48} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Waiting for Input</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Select a Brain Persona, provide input data, and run the simulation to see real-time output.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingLab;
