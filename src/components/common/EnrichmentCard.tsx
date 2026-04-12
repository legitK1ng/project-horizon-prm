import React from 'react';
import { useEnrichments, useTriggerEnrichment } from '@/hooks/useHorizonData';
import { Info, Mail, Phone, Globe, Linkedin, Twitter, RefreshCw, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/ui';

interface EnrichmentCardProps {
  contactId: string;
  contactName?: string; // Optional if not used
  className?: string;
}

// Define specific result types to fix TS errors
interface EmailResult { email?: string; }
interface SocialResult { linkedin_url?: string; x_handle?: string; }
interface OrgResult { website?: string; }
interface PhoneResult { carrier?: string; validity?: boolean; }
interface AIResult { narrative?: string; }

const EnrichmentCard: React.FC<EnrichmentCardProps> = ({ contactId, className }) => {
  const { data: enrichments, isLoading, isError, refetch } = useEnrichments(contactId);
  const triggerMutation = useTriggerEnrichment();

  const handleTrigger = async () => {
    if (triggerMutation.isPending) return;
    await triggerMutation.mutateAsync(contactId);
    refetch();
  };

  if (isLoading) {
    return (
      <div className={cn("glass p-6 rounded-3xl animate-pulse flex flex-col items-center justify-center min-h-[200px]", className)}>
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-medium">Scanning OSINT signals...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("glass p-6 rounded-3xl border-red-500/20 bg-red-500/5", className)}>
        <div className="flex items-center gap-3 text-red-600 mb-2">
          <AlertCircle size={20} />
          <h3 className="font-bold">Intelligence Gap</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">Failed to fetch enrichment data for this contact.</p>
        <button 
          onClick={() => refetch()}
          className="text-xs font-bold text-blue-600 uppercase tracking-widest hover:underline"
        >
          Retry Scan
        </button>
      </div>
    );
  }

  const latestJobs = enrichments || [];
  
  // Helper to find specific stage results
  const getJobByStage = (stage: number) => latestJobs.find((j: any) => j.stage === stage);
  const phoneJob = getJobByStage(2);
  const emailJob = getJobByStage(3);
  const orgJob = getJobByStage(4);
  const socialJob = getJobByStage(5);
  const aiJob = getJobByStage(6);

  const emailRes = emailJob?.result_json as EmailResult | undefined;
  const socialRes = socialJob?.result_json as SocialResult | undefined;
  const orgRes = orgJob?.result_json as OrgResult | undefined;
  const phoneRes = phoneJob?.result_json as PhoneResult | undefined;
  const aiRes = aiJob?.result_json as AIResult | undefined;

  const isScanning = latestJobs.some((j: any) => j.status === 'IN_PROGRESS');

  return (
    <div className={cn("glass p-8 rounded-[2rem] border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden group", className)}>
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/10 text-blue-600 rounded-2xl">
              <Info size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-none">Intelligence Profile</h3>
              <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-black tracking-widest">
                {isScanning ? 'Scan in Progress...' : 'Verified Intelligence'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={handleTrigger}
            disabled={triggerMutation.isPending}
            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50"
            title="Refresh Intelligence"
          >
            <RefreshCw size={18} className={cn("text-slate-500", triggerMutation.isPending && "animate-spin")} />
          </button>
        </div>

        {latestJobs.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-slate-400 text-sm font-medium italic">No deep intelligence found yet.</p>
            <button 
              onClick={handleTrigger}
              className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
            >
              Start Enrichment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identity Column */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-slate-400 mb-3">
                  <Mail size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Professional Identity</span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{emailRes?.email || 'N/A'}</p>
                {emailJob?.confidence && (
                  <div className="mt-2 flex items-center gap-2">
                    <CheckCircle2 size={12} className={cn(emailJob.confidence === 'HIGH' ? "text-emerald-500" : "text-amber-500")} />
                    <span className="text-[10px] text-slate-500 font-bold italic">
                      {emailJob.source_name} Confidence: {String(emailJob.confidence)}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-slate-400 mb-3">
                  <Globe size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Digital Presence</span>
                </div>
                <div className="flex gap-3">
                  {socialRes?.linkedin_url && (
                    <a href={socialRes.linkedin_url} target="_blank" rel="noreferrer" className="p-2 bg-[#0077b5]/10 text-[#0077b5] rounded-lg hover:scale-105 transition-transform">
                      <Linkedin size={16} />
                    </a>
                  )}
                  {socialRes?.x_handle && (
                    <a href={`https://x.com/${socialRes.x_handle}`} target="_blank" rel="noreferrer" className="p-2 bg-slate-900/10 text-slate-900 dark:text-white rounded-lg hover:scale-105 transition-transform">
                      <Twitter size={16} />
                    </a>
                  )}
                  {orgRes?.website && (
                    <a href={`https://${orgRes.website}`} target="_blank" rel="noreferrer" className="p-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:scale-105 transition-transform">
                      <Globe size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Context Column */}
            <div className="space-y-4">
               <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-slate-400 mb-3">
                  <Phone size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Connectivity</span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{phoneRes?.carrier || 'N/A'}</p>
                {phoneRes?.validity === true && (
                  <span className="mt-2 inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-black rounded-md border border-emerald-500/20">
                    VERIFIED
                  </span>
                )}
              </div>

              <div className="p-4 bg-blue-600/5 dark:bg-blue-600/10 rounded-2xl border border-blue-600/20">
                <div className="flex items-center gap-3 text-blue-500 mb-3">
                  <RefreshCw size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">AI Synthesis</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
                  {aiRes?.narrative || (isScanning ? "Synthesizing intelligence signals..." : "No narrative available.")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnrichmentCard;
