
import { GoogleGenAI, Type } from "@google/genai";
import { ExecutiveBrief } from "../types";

export class GeminiService {
  // Removed internal state ai to follow SDK guideline: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  async generateBrief(transcript: string): Promise<ExecutiveBrief> {
    // Guideline: Initialize client right before use
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following raw call transcript as a Strategic Consultant.
      Transcript: "${transcript}"`,
      config: {
        systemInstruction: "You are a Strategic Consultant for a Personal Relationship Management system. Your goal is to analyze raw call transcripts and generate a professional, structured executive brief. Focus on identifying actionable items and strategic implications.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Professional title starting with "Actionable Input: "'
            },
            summary: {
              type: Type.STRING,
              description: 'A 2-3 sentence strategic summary.'
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Bulleted list of next steps.'
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Contextual tags like #finance, #urgent, etc.'
            }
          },
          required: ['title', 'summary', 'actionItems', 'tags']
        }
      }
    });

    try {
      // FIX: Trim whitespace immediately so regex anchors (^) work correctly
      let text = (response.text || '{}').trim();
      
      // Clean up Markdown code blocks if present (common in LLM outputs)
      if (text.startsWith('```')) {
        text = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(text);

      // Validate and apply defaults to ensure UI doesn't crash on missing fields
      return {
        title: parsed.title || "Analysis Complete",
        summary: parsed.summary || "No summary provided.",
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : []
      } as ExecutiveBrief;

    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      throw new Error("Analysis failed: Invalid JSON format");
    }
  }

  /**
   * Simulates the ACR Phone webhook cleaning logic
   * Includes error handling for malformed URI components (e.g. user types "50%")
   */
  cleanTranscript(raw: string): string {
    try {
      return decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
    } catch (e) {
      // If decoding fails (URIError), assume it's already plain text
      return raw.trim();
    }
  }
}

export const geminiService = new GeminiService();
