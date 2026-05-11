/**
 * IntelligenceDossier — Supabase-Direct Data View
 *
 * Renders enriched transcripts, Google Contact matches, and OSINT logs
 * fetched directly from Supabase (no FastAPI). FastAPI is only called
 * for the "Trigger Enrichment" action button.
 *
 * Drop this into any route. It works in browser AND native Capacitor WebView.
 */


import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSupabaseCalls, useGoogleContactMatch, useSupabaseEnrichments } from '../hooks/useSupabaseData';
import { useContacts } from '../hooks/useHorizonData'; // keeps using cached FastAPI contacts until migrated
import type { CallRecord, EnrichmentJob } from '../types';
import { api } from '../services/apiClient'; // FastAPI — only for mutations
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Brain, Phone, Users, Shield, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

// ── Sub-components ─────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  const map: Record<string, string> = {
    Positive: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Negative: 'bg-red-500/20 text-red-300 border-red-500/30',
    Neutral:  'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };
  if (!sentiment) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[sentiment] ?? map.Neutral}`}>
      {sentiment}
    </span>
  );
}

function TranscriptCard({ call }: { call: CallRecord }) {
  const [expanded, setExpanded] = useState(false);
  const brief = call.executive_brief;

  return (
    <motion.div
      className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-lg p-4 space-y-3 hover:border-violet-500/30 transition-colors shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.08)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 14 } as const}
      whileHover={{ y: -1, scale: 1.005 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white">{call.contact_name}</p>
          <p className="text-xs text-slate-400">
            {new Date(call.timestamp).toLocaleString()} &middot; {call.duration ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SentimentBadge sentiment={call.sentiment} />
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            call.status === 'COMPLETED'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
          }`}>{call.status ?? 'QUEUED'}</span>
        </div>
      </div>

      {/* Executive Brief */}
      {brief && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3 space-y-1">
          {brief.summary && <p className="text-sm text-slate-300">{brief.summary}</p>}
          {brief.action_items?.length ? (
            <ul className="mt-1 space-y-0.5">
              {brief.action_items.map((item, i) => (
                <li key={i} className="text-xs text-violet-300 flex gap-1.5">
                  <span className="text-violet-500 mt-0.5">›</span>{item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Transcript toggle */}
      {call.transcript && (
        <>
          <button
            onClick={() => setExpanded((e: boolean) => !e)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'Show'} transcript
          </button>
          {expanded && (
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-black/30 backdrop-blur-sm rounded p-3 max-h-64 overflow-y-auto">
              {call.transcript}
            </pre>
          )}
        </>
      )}
    </motion.div>
  );
}

function OsintPanel({ contactId }: { contactId: string }) {
  const { data: enrichments, isLoading, error } = useSupabaseEnrichments(contactId);

  if (isLoading) return <p className="text-xs text-slate-500 animate-pulse">Loading OSINT signals…</p>;
  if (error) return <p className="text-xs text-red-400">Failed to load enrichments</p>;
  if (!enrichments?.length) return <p className="text-xs text-slate-500">No enrichment data yet.</p>;

  return (
    <div className="space-y-2">
      {enrichments.map((job: EnrichmentJob) => (
        <div key={job.id} className="rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">{job.source_name ?? `Stage ${job.stage}`}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              job.status === 'COMPLETE' ? 'text-emerald-400' :
              job.status === 'FAILED'   ? 'text-red-400' :
              'text-amber-400'
            }`}>{job.status}</span>
          </div>
          {job.confidence && (
            <p className="text-xs text-slate-500 mt-1">Confidence: {job.confidence}</p>
          )}
          {job.result_json && (
            <pre className="text-xs text-slate-400 mt-2 bg-black/40 rounded p-2 overflow-x-auto max-h-32">
              {JSON.stringify(job.result_json, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function GoogleMatchPanel({ contactId }: { contactId: string }) {
  const { data, isLoading } = useGoogleContactMatch(contactId);
  if (isLoading) return <p className="text-xs text-slate-500 animate-pulse">Checking Google sync…</p>;
  if (!data?.google_resource_name) return <p className="text-xs text-slate-500">Not synced with Google Contacts.</p>;

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 backdrop-blur-lg p-3 space-y-1">
      <p className="text-xs text-blue-300">✓ Linked to Google Contacts</p>
      {data.photo_url && (
        <img src={data.photo_url} alt="Google Contact" className="w-10 h-10 rounded-full border border-blue-500/30" />
      )}
      <p className="text-xs text-slate-400 break-all">{data.google_resource_name}</p>
      {data.last_synced && (
        <p className="text-xs text-slate-500">Last synced: {new Date(data.last_synced).toLocaleString()}</p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface IntelligenceDossierProps {
  /** Pre-selected contact ID to focus. If null, shows all calls. */
  contactId?: string;
}

export function IntelligenceDossier({ contactId }: IntelligenceDossierProps) {
  const qc = useQueryClient();
  const { data: calls, isLoading: callsLoading, error: callsError } = useSupabaseCalls();
  const { data: contacts } = useContacts(); // from FastAPI (existing hook)

  const enrichMutation = useMutation({
    mutationFn: (id: string) => api.triggerEnrichment(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['sb', 'enrichments', id] });
    },
  });

  const filteredCalls = contactId
    ? (calls ?? []).filter(c => c.contact_id === contactId)
    : (calls ?? []);

  const selectedContact = contactId
    ? contacts?.find(c => c.id === contactId)
    : null;

  if (callsLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading intelligence feed from Supabase…</span>
      </div>
    );
  }

  if (callsError) {
    return (
      <div className="flex items-center gap-2 text-red-400 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
        <AlertCircle size={16} />
        <span className="text-sm">Failed to connect to Supabase: {(callsError as Error).message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contact Intelligence Header */}
      {selectedContact && (
        <motion.div
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 } as const}
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {selectedContact.full_name ?? `${selectedContact.first_name} ${selectedContact.last_name ?? ''}`.trim()}
              </h2>
              <p className="text-sm text-slate-400">{selectedContact.organization ?? selectedContact.org ?? '—'}</p>
            </div>
            <button
              onClick={() => enrichMutation.mutate(selectedContact.id)}
              disabled={enrichMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/40 disabled:opacity-50 transition-colors"
            >
              {enrichMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
              {enrichMutation.isPending ? 'Enriching…' : 'Run OSINT'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Three-column intelligence layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transcripts column */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Phone size={14} />
            <span>Call Records & Transcripts</span>
            <span className="ml-auto text-xs text-slate-500">{filteredCalls.length} records</span>
          </div>
          {filteredCalls.length === 0 ? (
            <p className="text-sm text-slate-500 p-4 rounded-xl border border-white/5 text-center">
              No calls found.
            </p>
          ) : (
            filteredCalls.map(call => <TranscriptCard key={call.id} call={call} />)
          )}
        </div>

        {/* Side intelligence panels */}
        {selectedContact && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Users size={14} />
                <span>Google Contact Match</span>
              </div>
              <GoogleMatchPanel contactId={selectedContact.id} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Shield size={14} />
                <span>OSINT Signals</span>
              </div>
              <OsintPanel contactId={selectedContact.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IntelligenceDossier;
