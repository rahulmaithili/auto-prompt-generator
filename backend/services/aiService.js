import { GoogleGenAI } from '@google/genai';

/**
 * Service to interact with the Gemini API (direct) and OpenRouter API (as a fallback).
 */
export class AIService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.openrouterApiKey = process.env.OPENROUTER_API_KEY;

    if (this.geminiApiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.geminiApiKey });
    }
  }

  /**
   * Optimizes a raw prompt using direct Gemini API or OpenRouter fallback.
   * @param {string} rawPrompt - The raw prompt from the user.
   * @param {string} tone - The improvement tone: 'simple', 'advanced', or 'expert'.
   * @returns {Promise<object>} The structured analysis and improved prompt.
   */
  async improvePrompt(rawPrompt, tone = 'advanced') {
    let lastError = null;

    // 1. Try Direct Gemini API first (if key exists)
    if (this.geminiApiKey) {
      try {
        console.log('Attempting direct Gemini API call (gemini-2.5-flash)...');
        const data = await this.improveWithGemini(rawPrompt, tone);
        return {
          original_prompt: rawPrompt,
          tone: tone,
          api_source: 'gemini_direct',
          ...data
        };
      } catch (geminiError) {
        console.error('Direct Gemini API call failed:', geminiError.message || geminiError);
        lastError = geminiError;
      }
    }

    // 2. Fallback to OpenRouter (if key exists and Gemini failed or was skipped)
    if (this.openrouterApiKey) {
      try {
        console.log('Falling back to OpenRouter API (openrouter/free)...');
        const data = await this.improveWithOpenRouter(rawPrompt, tone);
        return {
          original_prompt: rawPrompt,
          tone: tone,
          api_source: 'openrouter_fallback',
          ...data
        };
      } catch (orError) {
        console.error('OpenRouter fallback API call failed:', orError.message || orError);
        lastError = orError;
      }
    }

    // If both failed, throw error
    throw new Error(
      lastError 
        ? `Prompt optimization failed. Last error: ${lastError.message || lastError}` 
        : 'No API credentials configured in .env file.'
    );
  }

  /**
   * Direct call to Gemini API using official Google Gen AI SDK
   */
  async improveWithGemini(rawPrompt, tone) {
    const systemInstruction = `You are a professional prompt engineer and meta-prompting expert.
Your job is to analyze the user's raw input prompt, classify its intent, score it out of 10, diagnose what essential elements are missing, and rewrite it into a highly structured, high-performing master prompt.

SPEED REQUIREMENT: Keep your responses highly concise.
- Limit 'gaps' to a maximum of 2-3 most critical items. Keep each item under 5 words.
- Limit 'explanation' to a single ultra-short sentence (maximum 15 words).
- Focus processing time entirely on writing a high-quality 'improved_prompt'.

Ensure the output is formatted as JSON matching the requested schema. Make sure the 'improved_prompt' is clean and doesn't contain markdown system wrapper code (like code blocks) inside the prompt itself.

Guidelines for rewriting the prompt based on the requested tone:
- 'simple': Keep it clean, direct, and clear. Add a basic role and format, but keep it brief.
- 'advanced': Add an expert persona, clear context, direct requirements, constraints, and structured output formatting.
- 'expert': Create a full enterprise-grade master prompt. Define a deep persona, input variables, detailed step-by-step logic, strict constraints, quality check verification, and a specific markdown output template.`;

    const userContent = `Improve the following raw prompt.
Tone: ${tone}
Raw Prompt: "${rawPrompt}"`;

    const schema = {
      type: "OBJECT",
      properties: {
        category: { 
          type: "STRING", 
          description: "The domain of the prompt" 
        },
        score_before: { 
          type: "INTEGER", 
          description: "Prompt quality score out of 10 before improvements (1-10)" 
        },
        score_after: { 
          type: "INTEGER", 
          description: "Optimized prompt quality score out of 10 after improvements (1-10)" 
        },
        gaps: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "List of maximum 3 critical missing elements (e.g., Vague Context, Missing Persona, No CTA). Keep each item short."
        },
        explanation: { 
          type: "STRING", 
          description: "A single ultra-short explanation of why it is better (maximum 15 words)." 
        },
        improved_prompt: { 
          type: "STRING", 
          description: "The complete, optimized, rewritten prompt, formatted beautifully using markdown headers if appropriate." 
        }
      },
      required: ["category", "score_before", "score_after", "gaps", "explanation", "improved_prompt"]
    };

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userContent,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.2,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response received from Gemini API');
    }

    return JSON.parse(text);
  }

  /**
   * Fallback call to OpenRouter using free models
   */
  async improveWithOpenRouter(rawPrompt, tone) {
    const systemInstruction = `You are a professional prompt engineer and meta-prompting expert.
Your job is to analyze the user's raw input prompt, classify its intent, score it out of 10, diagnose what essential elements are missing, and rewrite it into a highly structured, high-performing master prompt.

You MUST respond ONLY with a JSON object. Do not wrap the JSON in markdown code blocks.
The JSON must have the following exact keys:
{
  "category": "Domain of the prompt",
  "score_before": 3,
  "score_after": 9,
  "gaps": ["Detail 1 missing", "Detail 2 missing"],
  "explanation": "Why this improved version is better.",
  "improved_prompt": "The optimized prompt."
}

Guidelines for rewriting the prompt based on the requested tone:
- 'simple': Keep it clean, direct.
- 'advanced': Add expert persona, clear context, requirements, constraints, and formatting.
- 'expert': Create a full enterprise-grade master prompt.`;

    const userContent = `Improve the following raw prompt.
Tone: ${tone}
Raw Prompt: "${rawPrompt}"`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.openrouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/auto-prompt-generator",
        "X-Title": "Auto Prompt Generator"
      },
      body: JSON.stringify({
        model: "openrouter/free",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userContent }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errText}`);
    }

    const resData = await response.json();
    const choice = resData.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error('Invalid or empty response from OpenRouter API');
    }

    let text = choice.message.content.trim();
    // Clean up markdown code blocks if the model outputs them
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');

    return JSON.parse(text);
  }
}
