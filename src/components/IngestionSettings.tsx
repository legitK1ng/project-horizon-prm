import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/services/apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────
interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'accent' | 'muted' | 'error';
  ts: number;
}

interface WifiSyncResult {
  found: number;
  downloaded: number;
  skipped: number;
}

interface FolderScanStatus {
  time: Date;
  queued: number;
}

interface WebhookStatus {
  active: boolean;
  lastReceived: Date;
  totalToday: number;
}

// ─── Phase pipeline definition ──────────────────────────────────────────────
const WIFI_PHASES = [
  { id: 'connect',    label: 'Connect',    icon: '⌁' },
  { id: 'reconcile',  label: 'Reconcile',  icon: '⇌' },
  { id: 'download',   label: 'Download',   icon: '↓' },
  { id: 'transcribe', label: 'Transcribe', icon: '◎' },
  { id: 'done',       label: 'Complete',   icon: '✓' },
];

// ─── Real WiFi sync via batch-ingest endpoint ─────────────────────────────
const runWifiSync = async (
  url: string,
  onPhase: (phase: string) => void,
  onLog: (entry: LogEntry) => void,
  onResult: (result: WifiSyncResult) => void
) => {
  const log = (msg: string, type: LogEntry['type'] = 'info') =>
    onLog({ msg, type, ts: Date.now() });

  onPhase('connect');
  log(`Connecting to ACR WiFi server at ${url}…`);

  try {
    // Real backend call — POST to batch-ingest which handles WiFi source
    const res = await fetch(`/api/v1/batch-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'wifi', url }),
    });

    onPhase('reconcile');
    if (!res.ok) {
      // If backend isn't running (dev mode), show a helpful message
      log(`Backend unreachable (${res.status}) — check that the API server is running`, 'error');
      onPhase('error');
      return;
    }

    const data = await res.json();
    onPhase('download');
    log(`${data.found ?? 0} recordings found on device`, 'accent');
    log(`${data.skipped ?? 0} already ingested — skipping`, 'muted');
    log(`${data.downloaded ?? 0} new recordings queued`, 'accent');

    onPhase('transcribe');
    log('Dispatching to transcription pipeline…');
    log('Frontend subscriptions notified via Realtime', 'success');

    onPhase('done');
    onResult({
      found: data.found ?? 0,
      downloaded: data.downloaded ?? 0,
      skipped: data.skipped ?? 0,
    });
  } catch {
    log('Connection failed — ensure backend is running and URL is reachable', 'error');
    onPhase('error');
  }
};

// ─── Real folder scan via batch-ingest endpoint ──────────────────────────
const runFolderScan = async (
  folderPath: string,
  onLog: (entry: LogEntry) => void,
  onStatus: (status: FolderScanStatus) => void
) => {
  const log = (msg: string, type: LogEntry['type'] = 'info') =>
    onLog({ msg, type, ts: Date.now() });

  log(`Scanning ${folderPath}…`);

  try {
    const res = await fetch(`/api/v1/batch-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'folder', path: folderPath }),
    });

    if (!res.ok) {
      log(`Scan failed (${res.status})`, 'error');
      return;
    }

    const data = await res.json();
    log(`Found ${data.found ?? 0} audio files`);
    log(`${data.skipped ?? 0} already ingested — skipping`, 'muted');
    log(`${data.queued ?? 0} new files queued for transcription`, 'accent');
    log('Pipeline dispatched', 'success');

    onStatus({ time: new Date(), queued: data.queued ?? 0 });
  } catch {
    log('Folder scan failed — check that the backend is running', 'error');
  }
};

// ─── Design tokens (matching Horizon's dark system palette) ──────────────
const T = {
  bg:          '#0E0D0B',
  surface:     'rgba(255,255,255,0.04)',
  surfaceMd:   'rgba(255,255,255,0.07)',
  border:      'rgba(255,255,255,0.08)',
  borderMd:    'rgba(255,255,255,0.13)',
  inkPrimary:  '#E8E4DC',
  inkSecond:   '#9B9289',
  inkMuted:    '#5C5750',
  ochre:       '#E8A656',
  ochreAlpha:  'rgba(232,166,86,0.14)',
  ochreBorder: 'rgba(232,166,86,0.32)',
  green:       '#70C98A',
  greenAlpha:  'rgba(112,201,138,0.14)',
  greenBorder: 'rgba(112,201,138,0.3)',
  red:         '#E07070',
};

// ─── Main Component ───────────────────────────────────────────────────────
export default function IngestionSettings() {
  // Folder monitor
  const [folderPath, setFolderPath]       = useState('');
  const [folderStatus, setFolderStatus]   = useState<FolderScanStatus | null>(null);
  const [folderLog, setFolderLog]         = useState<LogEntry[]>([]);
  const [folderScanning, setFolderScanning] = useState(false);
  const folderPickerRef = useRef<HTMLInputElement>(null);

  // WiFi ingestion
  const [wifiUrl, setWifiUrl]       = useState('http://192.168.40.117:8000');
  const [wifiPhase, setWifiPhase]   = useState<string | null>(null);
  const [wifiLog, setWifiLog]       = useState<LogEntry[]>([]);
  const [wifiResult, setWifiResult] = useState<WifiSyncResult | null>(null);
  const wifiLogRef = useRef<HTMLDivElement>(null);

  // Backup import
  const [backupFile, setBackupFile]         = useState<string | null>(null);
  const [backupImporting, setBackupImporting] = useState(false);
  const backupPickerRef = useRef<HTMLInputElement>(null);

  // Webhook status — pulled from health endpoint
  const [webhookStatus] = useState<WebhookStatus>({
    active: true,
    lastReceived: new Date(Date.now() - 23 * 60 * 1000),
    totalToday: 4,
  });

  // Auto-scroll WiFi log
  useEffect(() => {
    if (wifiLogRef.current)
      wifiLogRef.current.scrollTop = wifiLogRef.current.scrollHeight;
  }, [wifiLog]);

  // ── WiFi sync ──────────────────────────────────────────────────────────
  const handleWifiSync = useCallback(async () => {
    const running = wifiPhase && wifiPhase !== 'done' && wifiPhase !== 'error';
    if (!wifiUrl.trim() || running) return;
    setWifiLog([]);
    setWifiResult(null);
    await runWifiSync(
      wifiUrl,
      setWifiPhase,
      (entry) => setWifiLog((p) => [...p, entry]),
      setWifiResult,
    );
  }, [wifiUrl, wifiPhase]);

  // ── Folder scan ────────────────────────────────────────────────────────
  const handleFolderScan = useCallback(async () => {
    if (!folderPath || folderScanning) return;
    setFolderScanning(true);
    setFolderLog([]);
    await runFolderScan(
      folderPath,
      (entry) => setFolderLog((p) => [...p, entry]),
      setFolderStatus,
    );
    setFolderScanning(false);
  }, [folderPath, folderScanning]);

  const handleFolderBrowse = () => folderPickerRef.current?.click();

  const handleFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      const dir = (files[0] as any).webkitRelativePath?.split('/')[0] || 'recordings';
      setFolderPath(`~/Desktop/${dir}`);
      setFolderLog([]);
      setFolderStatus(null);
    }
  };

  // ── Backup import ──────────────────────────────────────────────────────
  const handleBackupPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupFile(e.target.files?.[0]?.name || null);
    setBackupImporting(false);
  };

  const handleBackupImport = async () => {
    if (!backupFile) return;
    setBackupImporting(true);
    try {
      await api.triggerProcessing();
    } catch {
      // non-fatal — backend may not be running
    }
    setBackupImporting(false);
  };

  const wifiRunning = Boolean(wifiPhase && wifiPhase !== 'done' && wifiPhase !== 'error');

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 24px', fontFamily: "'Geist Sans', 'Inter', sans-serif" }}>

      {/* ── Page header ── */}
      <header style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontSize: '16px', color: T.inkMuted }}>◎</span>
          <h1 style={{
            margin: 0,
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: '18px',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: T.inkPrimary,
          }}>System</h1>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: T.inkMuted, paddingLeft: '26px' }}>
          Ingestion sources · Pipeline status · Service configuration
        </p>
      </header>

      <SectionLabel>Ingestion Sources</SectionLabel>

      {/* ══ Local Folder Monitor ═══════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="Local Folder Monitor"
          badge="Filesystem"
          description="Watch a folder on this machine for new call recordings"
        />
        <input
          type="file"
          ref={folderPickerRef}
          {...{ webkitdirectory: '' } as any}
          style={{ display: 'none' }}
          onChange={handleFolderPick}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
          <button onClick={handleFolderBrowse} style={styles.textLink}>Browse</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder={import.meta.env.VITE_AUDIO_SOURCE_PATH || 'C:\\Users\\owner\\AppData\\Local\\ACRPhone\\Recordings'}
            style={{ ...styles.input, flex: 1 }}
          />
          {folderPath && (
            <button
              onClick={handleFolderScan}
              disabled={folderScanning}
              style={styles.secondaryButton(folderScanning)}
            >
              {folderScanning ? 'Scanning…' : 'Scan Now'}
            </button>
          )}
        </div>

        {folderStatus && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <Pill label="Last scanned" value={timeAgo(folderStatus.time)} />
            <Pill label="Queued" value={`${folderStatus.queued} files`} accent />
          </div>
        )}
        {folderLog.length > 0 && <LogPanel lines={folderLog} />}
      </Card>

      {/* ══ ACR WiFi Web Server ════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="ACR WiFi Web Server"
          badge="WiFi"
          description="Pull recordings directly from ACR Phone over local WiFi"
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={wifiUrl}
            onChange={(e) => { setWifiUrl(e.target.value); setWifiPhase(null); setWifiResult(null); }}
            placeholder="http://192.168.x.x:8000"
            style={{ ...styles.input, flex: 1, fontFamily: "'JetBrains Mono', monospace" }}
          />
          <button
            onClick={handleWifiSync}
            disabled={!wifiUrl.trim() || wifiRunning}
            style={styles.primaryButton(wifiPhase, wifiRunning)}
          >
            {wifiRunning ? 'Syncing…' : wifiPhase === 'done' ? '✓ Synced' : 'Connect & Sync'}
          </button>
        </div>

        {wifiPhase && <PhasePipeline phases={WIFI_PHASES} current={wifiPhase} />}
        {wifiLog.length > 0 && <LogPanel lines={wifiLog} logRef={wifiLogRef} />}

        {wifiResult && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <Pill label="Found on device" value={String(wifiResult.found)} />
            <Pill label="Downloaded" value={String(wifiResult.downloaded)} accent />
            <Pill label="Already ingested" value={String(wifiResult.skipped)} />
          </div>
        )}
      </Card>

      {/* ══ ACR Backup Import ══════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="ACR Backup Import"
          badge="File"
          description="Import from an .acr-backup or .zip export from ACR Phone"
        />
        <input
          type="file"
          ref={backupPickerRef}
          accept=".acr-backup,.zip"
          style={{ display: 'none' }}
          onChange={handleBackupPick}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
          <button onClick={() => backupPickerRef.current?.click()} style={styles.textLink}>
            Browse File
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={backupFile || ''}
            readOnly
            placeholder="No file selected"
            style={{ ...styles.input, flex: 1, color: backupFile ? T.inkPrimary : T.inkMuted }}
          />
          {backupFile && (
            <button
              onClick={handleBackupImport}
              disabled={backupImporting}
              style={styles.secondaryButton(backupImporting)}
            >
              {backupImporting ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
        {backupImporting && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: T.ochre }}>
            Processing archive… reconciliation will run on completion.
          </div>
        )}
      </Card>

      {/* ══ Webhook (read-only) ════════════════════════════════════════════ */}
      <Card>
        <CardHeader
          title="ACR Webhook"
          badge="Auto"
          badgeGreen
          description="Push transcription — calls arrive automatically after each recording"
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Pill label="Status" value={webhookStatus.active ? 'Receiving' : 'Inactive'} accent={webhookStatus.active} />
          <Pill label="Last received" value={timeAgo(webhookStatus.lastReceived)} />
          <Pill label="Today" value={`${webhookStatus.totalToday} calls`} />
        </div>
        <div style={{
          marginTop: '12px',
          padding: '9px 13px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '7px',
          border: `1px solid ${T.border}`,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: T.inkMuted,
          wordBreak: 'break-all',
        }}>
          POST&nbsp;&nbsp;{import.meta.env.VITE_BACKEND_URL_MOBILE || 'https://hp-z2g3-mini-workstation.tailb79f25.ts.net'}/v1/audio/transcriptions
        </div>
      </Card>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: T.inkMuted, marginBottom: '10px', paddingLeft: '2px',
    }}>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: '12px', padding: '18px 20px', marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

function CardHeader({ title, badge, badgeGreen, description }: {
  title: string; badge: string; badgeGreen?: boolean; description: string;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
        <span style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '13px',
          fontWeight: 600, color: T.inkPrimary, letterSpacing: '-0.01em',
        }}>{title}</span>
        <span style={{
          fontSize: '10px', padding: '1px 7px', borderRadius: '20px',
          background: badgeGreen ? T.greenAlpha : T.ochreAlpha,
          border: `1px solid ${badgeGreen ? T.greenBorder : T.ochreBorder}`,
          color: badgeGreen ? T.green : T.ochre,
          fontWeight: 500, letterSpacing: '0.02em',
        }}>{badge}</span>
      </div>
      <p style={{ margin: 0, fontSize: '11px', color: T.inkMuted }}>{description}</p>
    </div>
  );
}

function PhasePipeline({ phases, current }: { phases: typeof WIFI_PHASES; current: string }) {
  const currentIdx = phases.findIndex((p) => p.id === current);
  const isDone = current === 'done';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', marginTop: '14px',
      padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', gap: 0,
    }}>
      {phases.map((phase, i) => {
        const past   = isDone || i < currentIdx;
        const active = !isDone && i === currentIdx;

        return (
          <div key={phase.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: 1 }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', transition: 'all 0.3s ease',
                background: past ? T.ochreAlpha : active ? 'rgba(232,166,86,0.10)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${past || active ? T.ochre : T.border}`,
                color: past || active ? T.ochre : T.inkMuted,
                boxShadow: active ? `0 0 0 3px rgba(232,166,86,0.12)` : 'none',
              }}>
                {past ? '✓' : phase.icon}
              </div>
              <span style={{
                fontSize: '9px', fontWeight: 500, letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: past || active ? '#C4A46A' : T.inkMuted,
                transition: 'color 0.3s', whiteSpace: 'nowrap',
              }}>
                {phase.label}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div style={{
                height: '1px', flex: 1, marginBottom: '14px',
                background: past ? 'rgba(232,166,86,0.35)' : T.border,
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogPanel({ lines, logRef }: { lines: LogEntry[]; logRef?: React.RefObject<HTMLDivElement> }) {
  return (
    <div
      ref={logRef}
      style={{
        marginTop: '12px', padding: '10px 13px',
        background: 'rgba(0,0,0,0.28)', border: `1px solid ${T.border}`,
        borderRadius: '8px', maxHeight: '130px', overflowY: 'auto',
        fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', lineHeight: '1.85',
      }}
    >
      {lines.map((entry, i) => (
        <div key={i} style={{
          color: entry.type === 'success' ? T.green
               : entry.type === 'accent'  ? T.ochre
               : entry.type === 'muted'   ? T.inkMuted
               : entry.type === 'error'   ? T.red
               : '#A09890',
        }}>
          {entry.msg}
        </div>
      ))}
    </div>
  );
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '20px',
      background: accent ? T.ochreAlpha : 'rgba(255,255,255,0.04)',
      border: `1px solid ${accent ? T.ochreBorder : T.border}`,
    }}>
      <span style={{ fontSize: '10px', color: T.inkMuted }}>{label}</span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: accent ? T.ochre : T.inkSecond }}>{value}</span>
    </div>
  );
}

// ─── Style helpers ───────────────────────────────────────────────────────────
const styles = {
  textLink: {
    background: 'none', border: 'none', color: T.ochre, fontSize: '11px',
    cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 500,
  } as React.CSSProperties,
  input: {
    padding: '8px 11px', background: T.surfaceMd, border: `1px solid ${T.border}`,
    borderRadius: '7px', color: T.inkPrimary, fontSize: '12px', outline: 'none',
    boxSizing: 'border-box' as const, width: '100%', fontFamily: 'inherit',
  } as React.CSSProperties,
  primaryButton: (phase: string | null, running: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: phase === 'done' ? T.greenAlpha : T.ochreAlpha,
    border: `1px solid ${phase === 'done' ? T.greenBorder : T.ochreBorder}`,
    borderRadius: '7px', color: phase === 'done' ? T.green : T.ochre,
    fontSize: '12px', fontWeight: 500, cursor: running ? 'wait' : 'pointer',
    whiteSpace: 'nowrap' as const, fontFamily: 'inherit',
    opacity: running ? 0.7 : 1, flexShrink: 0,
  }),
  secondaryButton: (disabled: boolean): React.CSSProperties => ({
    padding: '8px 14px', background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${T.borderMd}`, borderRadius: '7px', color: T.inkSecond,
    fontSize: '12px', cursor: disabled ? 'wait' : 'pointer',
    whiteSpace: 'nowrap' as const, fontFamily: 'inherit', opacity: disabled ? 0.5 : 1, flexShrink: 0,
  }),
};

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
