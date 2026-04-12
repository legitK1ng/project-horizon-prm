import { 
  Sparkles, 
  Send, 
  FileJson
} from "lucide-react";
import { useState } from "react";
import { useIngestCall } from "../hooks/useHorizonData";
import toast from "react-hot-toast";

const IntelligenceWorkbench: React.FC = () => {
  const [ingestMode, setIngestMode] = useState<"manual" | "acr">("manual");
  const ingestMutation = useIngestCall();

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    // REQ-035: Manual data parsing -> AI Briefing
    const payload = {
      contact_name: formData.get("name") as string,
      phone_number: formData.get("phone") as string,
      transcript: formData.get("transcript") as string,
      timestamp: new Date().toISOString()
    };

    if (!payload.transcript) {
        toast.error("Please provide a call transcript.");
        return;
    }

    try {
      await ingestMutation.mutateAsync(payload);
      toast.success("Intelligence Briefing Generated!");
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      toast.error("Analysis Failed. Check the backend.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            Ingestion Lab
          </h3>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setIngestMode("manual")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${ingestMode === "manual" ? "bg-white dark:bg-slate-700 shadow-sm" : "text-slate-500"}`}
            >
              Manual
            </button>
            <button 
              onClick={() => setIngestMode("acr")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${ingestMode === "acr" ? "bg-white dark:bg-slate-700 shadow-sm" : "text-slate-500"}`}
            >
              ACR Log
            </button>
          </div>
        </div>

        {ingestMode === "manual" ? (
          <form onSubmit={handleManualIngest} className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <input 
                name="name" 
                placeholder="Contact Name" 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                required
              />
              <input 
                name="phone" 
                placeholder="Phone (optional)" 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <textarea 
              name="transcript" 
              placeholder="Paste call transcript here..." 
              className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors resize-none"
              required
            ></textarea>
            <button 
              type="submit" 
              disabled={ingestMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {ingestMutation.isPending ? "Analyzing..." : "Generate Proactive Brief"}
            </button>
          </form>
        ) : (
          <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-800">
              <FileJson className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-semibold">ACR Bulk Ingestion</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto">
              Run 'node scripts/ingest_acr_logs.js' to process structured phone data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligenceWorkbench;
