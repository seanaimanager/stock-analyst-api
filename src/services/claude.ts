import Anthropic from '@anthropic-ai/sdk';
import { STOCK_ANALYST_PROMPT, buildUserMessage } from '../prompts/analyst.js';
import type { AnalyzeRequest } from '../types/analysis.js';

const client = new Anthropic();

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

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    system: STOCK_ANALYST_PROMPT,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 10,
      } as any,
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        onText(event.delta.text);
      }
    } else if (event.type === 'content_block_start') {
      if (event.content_block.type === 'tool_use') {
        onToolUse(event.content_block.name);
      }
    }
  }

  onDone();
}
