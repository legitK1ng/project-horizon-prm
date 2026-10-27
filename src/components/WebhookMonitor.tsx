/**
 * WebhookMonitor.tsx
 * ───────────────────
 * Live monitor panel for the ACR Transcription Gateway.
 *
 * Features:
 *  - Auto-polling job table (5 s interval via useWebhookJobs)
 *  - Status badge with colours (QUEUED=yellow, PROCESSING=blue, COMPLETED=green, ERROR=red)
 *  - Transcript drawer with diarized speaker segments
 *  - Full-text copy-to-clipboard
 *  - Gateway health indicator
 *  - Console log feed for all activity
 */

import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Loader2,
  Phone,
  RefreshCw,
  ServerCrash,
  Wifi,
  WifiOff,
  X,
  AlertTriangle,
  Clock,
  Mic,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebhookJobs, useWebhookHealth, useWebhookTranscript } from "@/hooks/useWebhookJobs";
import type { WebhookJob, DiarizedSegment } from "@/services/webhookService";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── Status Badge ──────────────────────────────────────────────────────────────

type JobStatus = WebhookJob["status"];

const STATUS_CONFIG: Record<JobStatus, { label: string; className: string; icon: React.ReactNode }> = {
  QUEUED: {
    label: "QUEUED",
    className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50",
    icon: <Clock size={10} />,
  },
  PROCESSING: {
    label: "PROCESSING",
    className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50",
    icon: <Loader2 size={10} className="animate-spin" />,
  },
  COMPLETED: {
    label: "COMPLETED",
    className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50",
    icon: <CheckCircle2 size={10} />,
  },
  ERROR: {
    label: "ERROR",
    className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50",
    icon: <AlertTriangle size={10} />,
  },
};

function StatusBadge({ status }: { status: JobStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.QUEUED;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Speaker colours ───────────────────────────────────────────────────────────

const SPEAKER_COLOURS = [
  "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
  "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
  "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20",
  "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20",
  "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20",
];

function speakerColor(speaker: string): string {
  const idx = parseInt(speaker.replace(/\D/g, "") || "0", 10);
  return SPEAKER_COLOURS[idx % SPEAKER_COLOURS.length] as string;
}

// ── Transcript Drawer ─────────────────────────────────────────────────────────

function TranscriptDrawer({
  callId,
  onClose,
}: {
  callId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useWebhookTranscript(callId);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!data?.full_text) return;
    await navigator.clipboard.writeText(data.full_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Mic size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Transcript — {data?.phone_number ?? callId}
              </h3>
              {data && (
                <p className="text-xs text-slate-500">
                  {formatDate(data.call_date ?? null)} · {formatDuration(data.duration_seconds ?? null)} · {data.source ?? "Unknown"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
            >
              {copied ? <ClipboardCheck size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-blue-500" />
              <span className="text-sm">Loading transcript…</span>
            </div>
          )}
          {isError && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
              <ServerCrash size={28} className="text-red-400" />
              <span className="text-sm">Failed to load transcript.</span>
            </div>
          )}
          {data?.diarized_segments?.map((seg: DiarizedSegment, i: number) => (
            <div key={i} className="group flex gap-3">
              <div className={`flex-none mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${speakerColor(seg.speaker)}`}>
                {seg.speaker}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {seg.text}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {seg.start.toFixed(1)}s – {seg.end.toFixed(1)}s
                </p>
              </div>
            </div>
          ))}
          {data && (!data.diarized_segments || data.diarized_segments.length === 0) && (
            <p className="text-sm text-slate-400 text-center py-10">No transcript segments available.</p>
          )}
        </div>

        {/* Note */}
        {data?.note && (
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
            <p className="text-xs text-slate-500 font-medium">Note from ACR Phone</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{data.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const WebhookMonitor: React.FC = () => {
  const [openCallId, setOpenCallId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: jobList, isLoading, isError, dataUpdatedAt } = useWebhookJobs();
  const { data: healthData, isError: healthError } = useWebhookHealth();
  const jobs: WebhookJob[] = jobList?.jobs ?? [];

  const isOnline = !healthError && healthData?.status === "ok";

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["webhookJobs"] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
            <Phone size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">ACR Webhook Monitor</h3>
            <p className="text-xs text-slate-500">
              Gateway: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">100.101.99.29:8000</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Gateway health indicator */}
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
            isOnline
              ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40"
              : "text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          }`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? "Gateway Online" : "Gateway Offline"}
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {(["QUEUED", "PROCESSING", "COMPLETED", "ERROR"] as JobStatus[]).map((s) => {
          const count = jobs.filter((j) => j.status === s).length;
          return (
            <div key={s} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{count}</p>
              <StatusBadge status={s} />
            </div>
          );
        })}
      </div>

      {/* Job table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
            <Activity size={15} className="text-blue-500" />
            Transcript Jobs
          </h4>
          {dataUpdatedAt > 0 && (
            <span className="text-[10px] text-slate-400">
              Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 size={20} className="animate-spin text-blue-500" />
            <span className="text-sm">Connecting to gateway…</span>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <ServerCrash size={28} className="text-red-400" />
            <p className="text-sm text-center">
              Cannot reach gateway at <code className="font-mono text-xs">100.101.99.29:8000</code>.<br />
              Ensure <code className="font-mono text-xs">Start-Gateway.ps1</code> is running on the workstation.
            </p>
          </div>
        )}

        {!isLoading && !isError && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Phone size={24} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No calls received yet.</p>
              <p className="text-xs mt-1">
                Set ACR Phone webhook URL to{" "}
                <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  https://100.101.99.29:8000/api/Recording/upload
                </code>
              </p>
            </div>
          </div>
        )}

        {jobs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-5 py-3 font-medium">Phone</th>
                  <th className="text-left px-4 py-3 font-medium">Source</th>
                  <th className="text-left px-4 py-3 font-medium">Duration</th>
                  <th className="text-left px-4 py-3 font-medium">Received</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {jobs.map((job) => (
                  <tr
                    key={job.call_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {job.phone_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {job.source ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {formatDuration(job.duration_seconds)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {timeAgo(job.received_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      {job.status === "COMPLETED" && (
                        <button
                          id={`view-transcript-${job.call_id}`}
                          onClick={() => setOpenCallId(job.call_id)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          View
                        </button>
                      )}
                      {job.status === "ERROR" && (
                        <span className="text-xs text-red-500 truncate max-w-[120px] block" title={job.error ?? ""}>
                          {job.error ?? "Unknown error"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connection instructions */}
      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
          ACR Phone App Setup
        </p>
        <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
          <p>
            <span className="font-medium text-slate-700 dark:text-slate-300">Webhook URL:</span>{" "}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              https://100.101.99.29:8000/api/Recording/upload
            </code>
          </p>
          <p>
            <span className="font-medium text-slate-700 dark:text-slate-300">Secret Key:</span>{" "}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              magicalbluetuba
            </code>
          </p>
        </div>
      </div>

      {/* Transcript Drawer */}
      {openCallId && (
        <TranscriptDrawer callId={openCallId} onClose={() => setOpenCallId(null)} />
      )}
    </div>
  );
};

export default WebhookMonitor;
