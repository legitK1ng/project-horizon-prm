import { cleanTranscript } from '@/utils/helpers';

export interface TranscriptMessage {
    speaker: string;
    text: string;
    timestamp?: string;
    isOwner: boolean;
}

/**
 * Parse a raw transcript string into structured chat messages.
 * Tries multiple diarization formats and degrades gracefully.
 */
export function parseTranscript(raw: string, contactName: string): TranscriptMessage[] {
    const cleaned = cleanTranscript(raw);
    if (!cleaned || cleaned.trim().length === 0) return [];

    // Strategy 1: "Speaker 1:" / "Speaker 2:" format
    const speakerNPattern = /^(Speaker\s*\d+)\s*:/im;
    if (speakerNPattern.test(cleaned)) {
        return parseSpeakerN(cleaned);
    }

    // Strategy 2: "[Name]:" format (e.g., "[John]: Hello")
    const bracketPattern = /^\[([^\]]+)\]\s*:/m;
    if (bracketPattern.test(cleaned)) {
        return parseBracketNames(cleaned);
    }

    // Strategy 3: "Name:" at start of line (e.g., "John: Hello")
    // Only match if we see at least 2 different speakers
    const colonPattern = /^([A-Z][a-zA-Z\s]{1,25}):\s/m;
    const colonMatches = cleaned.match(new RegExp(colonPattern, 'gm'));
    if (colonMatches && colonMatches.length >= 2) {
        const uniqueSpeakers = new Set(colonMatches.map(m => m.replace(/:\s*$/, '').trim()));
        if (uniqueSpeakers.size >= 2) {
            return parseColonNames(cleaned);
        }
    }

    // Strategy 4: Double-newline paragraph alternation
    const paragraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length >= 2) {
        return parseParagraphAlternation(paragraphs, contactName);
    }

    // Fallback: Single message block
    return [{
        speaker: 'Transcript',
        text: cleaned,
        isOwner: true,
    }];
}

/** Parse "Speaker 1: ...\nSpeaker 2: ..." format */
function parseSpeakerN(text: string): TranscriptMessage[] {
    const messages: TranscriptMessage[] = [];
    const segments = text.split(/(?=^Speaker\s*\d+\s*:)/im);

    for (const segment of segments) {
        const match = segment.match(/^(Speaker\s*(\d+))\s*:\s*([\s\S]*)/i);
        if (match) {
            const speakerLabel = match[1]!.trim();
            const speakerNum = parseInt(match[2]!, 10);
            const content = match[3]!.trim();
            if (content) {
                messages.push({
                    speaker: speakerLabel,
                    text: content,
                    isOwner: speakerNum === 1, // Speaker 1 = caller (right side)
                });
            }
        }
    }

    return messages.length > 0 ? messages : [{ speaker: 'Transcript', text, isOwner: false }];
}

/** Parse "[Name]: ..." format */
function parseBracketNames(text: string): TranscriptMessage[] {
    const messages: TranscriptMessage[] = [];
    const segments = text.split(/(?=^\[[^\]]+\]\s*:)/m);
    let firstSpeaker: string | null = null;

    for (const segment of segments) {
        const match = segment.match(/^\[([^\]]+)\]\s*:\s*([\s\S]*)/);
        if (match) {
            const speaker = match[1]!.trim();
            const content = match[2]!.trim();
            if (!firstSpeaker) firstSpeaker = speaker;
            if (content) {
                messages.push({
                    speaker,
                    text: content,
                    isOwner: speaker === firstSpeaker,
                });
            }
        }
    }

    return messages.length > 0 ? messages : [{ speaker: 'Transcript', text, isOwner: false }];
}

/** Parse "Name: ..." format (colon-separated) */
function parseColonNames(text: string): TranscriptMessage[] {
    const messages: TranscriptMessage[] = [];
    const segments = text.split(/(?=^[A-Z][a-zA-Z\s]{1,25}:\s)/m);
    let firstSpeaker: string | null = null;

    for (const segment of segments) {
        const match = segment.match(/^([A-Z][a-zA-Z\s]{1,25}):\s([\s\S]*)/);
        if (match) {
            const speaker = match[1]!.trim();
            const content = match[2]!.trim();
            if (!firstSpeaker) firstSpeaker = speaker;
            if (content) {
                messages.push({
                    speaker,
                    text: content,
                    isOwner: speaker === firstSpeaker,
                });
            }
        }
    }

    return messages.length > 0 ? messages : [{ speaker: 'Transcript', text, isOwner: false }];
}

/** Parse double-newline separated paragraphs as alternating speakers */
function parseParagraphAlternation(paragraphs: string[], contactName: string): TranscriptMessage[] {
    const callerLabel = 'You';
    const otherLabel = contactName || 'Other';

    return paragraphs.map((text, i) => ({
        speaker: i % 2 === 0 ? callerLabel : otherLabel,
        text: text.trim(),
        isOwner: i % 2 === 0,
    }));
}
