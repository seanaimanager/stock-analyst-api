import { GoogleGenerativeAI } from '@google/generative-ai';
import { STOCK_ANALYST_PROMPT, buildUserMessage } from '../prompts/analyst.js';
import type { AnalyzeRequest } from '../types/analysis.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: STOCK_ANALYST_PROMPT,
  generationConfig: {
    maxOutputTokens: 16000,
  },
  tools: [{ googleSearch: {} } as any],
});

export async function streamAnalysis(
  request: AnalyzeRequest,
  onText: (text: string) => void,
  onToolUse: (name: string) => void,
  onDone: () => void
): Promise<void> {
  const userMessage = buildUserMessage(
    request.ticker,
    request.bias,
    request.riskAppetite,
    request.timeframe
  );

  const result = await model.generateContentStream(userMessage);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      onText(text);
    }
    // Check for grounding/search usage
    if (chunk.candidates?.[0]?.groundingMetadata) {
      onToolUse('google_search');
    }
  }

  onDone();
}
