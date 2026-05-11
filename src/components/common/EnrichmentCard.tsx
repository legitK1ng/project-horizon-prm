import React from 'react';
import { useEnrichments, useTriggerEnrichment } from '@/hooks/useHorizonData';
import { Info, Mail, Phone, Globe, Linkedin, Twitter, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/ui';
import { triggerHaptic } from '../../utils/haptics';
import { motion } from 'framer-motion';

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
    triggerHaptic('MEDIUM');
    await triggerMutation.mutateAsync(contactId);
    refetch();
  };

  const handleSocialClick = () => {
    triggerHaptic('LIGHT');
  };

  if (isLoading) {
    return (
      <div className={cn("glass-premium p-6 rounded-[2.5rem] animate-pulse flex flex-col items-center justify-center min-h-[200px]", className)}>
        <Loader2 className="w-8 h-8 text-horizon-500 animate-spin mb-4" />
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Scanning OSINT signals...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("glass-premium p-6 rounded-[2.5rem] border-premium-error/20 bg-premium-error/5", className)}>
        <div className="flex items-center gap-3 text-premium-error mb-2">
          <AlertCircle size={20} />
          <h3 className="text-xs font-black uppercase tracking-widest">Intelligence Gap</h3>
        </div>
        <p className="text-[10px] text-slate-500 mb-4 font-medium">Failed to fetch enrichment data for this contact.</p>
        <button 
          onClick={() => { triggerHaptic('MEDIUM'); refetch(); }}
          className="text-[9px] font-black text-horizon-600 dark:text-horizon-400 uppercase tracking-[0.2em] hover:opacity-80"
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
    <div className={cn("glass-premium p-8 rounded-[2.5rem] border-white/10 dark:border-slate-800 relative overflow-hidden group shadow-2xl shadow-black/20", className)}>
      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.07] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-horizon-500/10 rounded-full -mr-24 -mt-24 blur-[80px] group-hover:bg-horizon-500/20 transition-all duration-1000" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-horizon-500/10 text-horizon-600 dark:text-horizon-400 rounded-2xl shadow-inner border border-white/10">
              <Info size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-white leading-none">Intelligence Profile</h3>
              <p className="text-[10px] text-horizon-500 mt-2 uppercase font-black tracking-[0.25em]">
                {isScanning ? 'Scan in Progress...' : 'Verified Intelligence'}
              </p>
            </div>
          </div>
          
          <motion.button 
            whileHover={{ rotate: 180, scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleTrigger}
            disabled={triggerMutation.isPending}
            className="p-3 hover:bg-white/10 dark:hover:bg-slate-800 rounded-2xl transition-all disabled:opacity-50 border border-transparent hover:border-white/10"
            title="Refresh Intelligence"
          >
            <RefreshCw size={20} className={cn("text-slate-500", (triggerMutation.isPending || isScanning) && "animate-spin")} />
          </motion.button>
        </div>

        {latestJobs.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[2rem] bg-white/5">
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest italic mb-6">No deep intelligence found yet.</p>
            <button 
              onClick={handleTrigger}
              className="px-8 py-3.5 bg-horizon-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-glow hover:bg-horizon-600 transition-all active:scale-95"
            >
              Initialize Deep Scan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Identity Column */}
            <div className="space-y-6">
              <div className="p-5 bg-white/5 dark:bg-slate-950/40 rounded-[1.75rem] border border-white/10 dark:border-slate-800 shadow-xl shadow-black/5">
                <div className="flex items-center gap-3 text-horizon-500 mb-4 opacity-70">
                  <Mail size={12} strokeWidth={3} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Professional Identity</span>
                </div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate tracking-tight">{emailRes?.email || 'NOT_FOUND'}</p>
                {emailJob?.confidence && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full shadow-sm", emailJob.confidence === 'HIGH' ? "bg-emerald-500 shadow-emerald-500/50" : "bg-amber-500 shadow-amber-500/50")} />
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest italic">
                      {emailJob.confidence} Confidence
                    </span>
                  </div>
                )}
              </div>

              <div className="p-5 bg-white/5 dark:bg-slate-950/40 rounded-[1.75rem] border border-white/10 dark:border-slate-800 shadow-xl shadow-black/5">
                <div className="flex items-center gap-3 text-horizon-500 mb-4 opacity-70">
                  <Globe size={12} strokeWidth={3} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Digital Footprint</span>
                </div>
                <div className="flex gap-4">
                  {socialRes?.linkedin_url && (
                    <motion.a 
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleSocialClick}
                      href={socialRes.linkedin_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="p-3 bg-[#0077b5]/10 text-[#0077b5] rounded-xl border border-[#0077b5]/20 shadow-sm"
                    >
                      <Linkedin size={18} />
                    </motion.a>
                  )}
                  {socialRes?.x_handle && (
                    <motion.a 
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleSocialClick}
                      href={`https://x.com/${socialRes.x_handle}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="p-3 bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white rounded-xl border border-white/10 shadow-sm"
                    >
                      <Twitter size={18} />
                    </motion.a>
                  )}
                  {orgRes?.website && (
                    <motion.a 
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleSocialClick}
                      href={`https://${orgRes.website}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="p-3 bg-horizon-500/10 text-horizon-600 dark:text-horizon-400 rounded-xl border border-horizon-500/20 shadow-sm"
                    >
                      <Globe size={18} />
                    </motion.a>
                  )}
                </div>
              </div>
            </div>

            {/* Context Column */}
            <div className="space-y-6">
               <div className="p-5 bg-white/5 dark:bg-slate-950/40 rounded-[1.75rem] border border-white/10 dark:border-slate-800 shadow-xl shadow-black/5">
                <div className="flex items-center gap-3 text-horizon-500 mb-4 opacity-70">
                  <Phone size={12} strokeWidth={3} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Connectivity</span>
                </div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">{phoneRes?.carrier || 'CARRIER_UNKNOWN'}</p>
                {phoneRes?.validity === true && (
                  <span className="mt-3 inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black rounded border border-emerald-500/20 tracking-[0.1em]">
                    VALIDATED_LINE
                  </span>
                )}
              </div>

              <div className="p-5 bg-horizon-500/5 dark:bg-horizon-500/10 rounded-[1.75rem] border border-horizon-500/20 shadow-xl shadow-horizon-500/5">
                <div className="flex items-center gap-3 text-horizon-500 mb-4">
                  <RefreshCw size={12} strokeWidth={3} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Executive Synthesis</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic font-medium">
                  {aiRes?.narrative || (isScanning ? "Synthesizing intelligence signals..." : "NO_SYNTH_AVAILABLE")}
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
