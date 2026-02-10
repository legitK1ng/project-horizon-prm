import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExecutiveBrief } from '@/types';
import { GEMINI_CONFIG } from '@/constants';
import { cleanTranscript, parseJSON } from '@/utils/helpers';

class GeminiService {
  private getClient(): GoogleGenerativeAI {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env.local file.'
      );
    }

    return new GoogleGenerativeAI(apiKey);
  }

  async generateBrief(transcript: string): Promise<ExecutiveBrief> {
    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Transcript is too short to analyze');
    }

    const cleaned = cleanTranscript(transcript);
    const client = this.getClient();
    const model = client.getGenerativeModel({ model: GEMINI_CONFIG.model });

    const prompt = `${GEMINI_CONFIG.defaultSystemPrompt}

Analyze the following call transcript and provide a structured executive brief.

TRANSCRIPT:
${cleaned}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "title": "A professional title starting with 'Actionable Input: '",
  "summary": "A 2-3 sentence strategic summary",
  "actionItems": ["Action 1", "Action 2", "Action 3"],
  "tags": ["#tag1", "#tag2", "#tag3"],
  "sentiment": "Positive"
}`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text().trim();

      // Clean up markdown code blocks if present
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

      const parsed = parseJSON<Partial<ExecutiveBrief>>(text, {
        title: 'Analysis Complete',
        summary: 'Failed to parse response',
        actionItems: [],
        tags: ['#error'],
        sentiment: 'Neutral',
      });

      // Validate and return
      return {
        title: parsed.title || 'Analysis Complete',
        summary: parsed.summary || 'No summary provided.',
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        sentiment: parsed.sentiment || 'Neutral',
      };
    } catch (error) {
      console.error('Gemini API Error:', error);

      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('Invalid API key. Please check your configuration.');
        }
        if (error.message.includes('quota')) {
          throw new Error('API quota exceeded. Please try again later.');
        }
        throw new Error(`Analysis failed: ${error.message}`);
      }

      throw new Error('An unexpected error occurred during analysis');
    }
  }
}

export const geminiService = new GeminiService();
