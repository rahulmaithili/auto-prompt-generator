import { GoogleGenAI } from '@google/genai';

/**
 * Service to interact with the Gemini API for prompt improvement.
 */
export class AIService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('WARNING: GEMINI_API_KEY is not defined in the environment variables.');
    }
    // Initialize the official Gemini SDK
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Optimizes a raw prompt using the Gemini API.
   * @param {string} rawPrompt - The raw prompt from the user.
   * @param {string} tone - The improvement tone: 'simple', 'advanced', or 'expert'.
   * @returns {Promise<object>} The structured analysis and improved prompt.
   */
  async improvePrompt(rawPrompt, tone = 'advanced') {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API Key is missing. Please add GEMINI_API_KEY to your backend/.env file.');
    }

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
          description: "The domain of the prompt (e.g., Coding, Content Writing, Marketing, Research, Personal, Business)" 
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

    try {
      // Use gemini-2.5-flash for fast, structured, and affordable execution
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userContent,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.2, // Low temperature for high consistency and adherence to guidelines
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response received from Gemini API');
      }

      const parsedData = JSON.parse(text);
      return {
        original_prompt: rawPrompt,
        tone: tone,
        ...parsedData
      };
    } catch (error) {
      console.error('Error in AIService.improvePrompt:', error);
      throw error;
    }
  }
}
