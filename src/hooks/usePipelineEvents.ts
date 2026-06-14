/**
 * usePipelineEvents — Horizon PRM
 *
 * Subscribes to the `pipeline_events` Supabase Realtime channel and surfaces
 * live backend events to any component that cares.
 *
 * Schema (actual DB columns as of June 2026 migration):
 *   id, event_type, severity, source, reference_id, reference_type, message, detail, created_at
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type PipelineEventSource =
  | 'transcription'
  | 'batch_ingest'
  | 'enrichment'
  | 'sentinel'
  | 'digest'
  | 'system';

export type PipelineSeverity = 'info' | 'warning' | 'error';

export interface PipelineEvent {
  id?: string;
  event_type: string;          // lifecycle stage: started / completed / error / warning / info
  severity:   PipelineSeverity;
  source:     PipelineEventSource;
  reference_id?:   string;     // UUID of the related call_record
  reference_type?: string;
  message:    string;          // human-readable description
  detail?:    Record<string, unknown>;
  created_at: string;
}

const MAX_EVENTS  = 50;
const CHANNEL_NAME = 'pipeline_events_live';

export function usePipelineEvents() {
  const [events, setEvents]       = useState<PipelineEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const addEvent = useCallback((event: PipelineEvent) => {
    setEvents(prev => {
      const next = [event, ...prev];
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
    });
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pipeline_events' },
        (payload) => {
          const row = payload.new as PipelineEvent;
          addEvent(row);
          if (row.severity === 'error' || row.severity === 'warning') {
            console.warn(`[Horizon] ${row.source}:${row.event_type}`, row.message, row.detail);
          }
        }
      )
      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          console.error('[Horizon] pipeline_events Realtime subscription failed.');
        }
      });

    channelRef.current = channel;
    return () => { channel.unsubscribe(); channelRef.current = null; };
  }, [addEvent]);

  const latestError   = events.find(e => e.severity === 'error') ?? null;
  const errorCount    = events.filter(e => e.severity === 'error').length;
  const isProcessing  = events.some(e => e.event_type === 'started') &&
                        !events.find(e => e.event_type === 'completed' || e.severity === 'error');

  return { events, connected, latestError, errorCount, isProcessing, clearEvents };
}
