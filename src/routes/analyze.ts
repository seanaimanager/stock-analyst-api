import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { streamAnalysis } from '../services/claude.js';
import { detectPhaseBoundary, extractChartParams, extractCurrentPrice } from '../services/parser.js';
import { generateChart } from '../services/chart.js';

const router = Router();

const analyzeSchema = z.object({
  ticker: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  bias: z.enum(['bullish', 'bearish', 'neutral']).optional(),
  riskAppetite: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  timeframe: z.enum(['short', 'medium', 'long']).optional(),
});

router.post('/analyze', async (req: Request, res: Response) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { ticker, bias, riskAppetite, timeframe } = parsed.data;

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let buffer = '';
  let completedPhases: number[] = [];
  let currentPrice: number | null = null;
  let phase2Raw = '';
  let fullText = '';

  sendEvent('progress', { message: `Starting analysis of ${ticker}...`, phase: 0 });

  try {
    await streamAnalysis(
      { ticker, bias, riskAppetite, timeframe },
      // onText
      (text: string) => {
        buffer += text;
        fullText += text;

        // Try to detect completed phases
        let result = detectPhaseBoundary(buffer);
        while (result.completedPhase) {
          const phase = result.completedPhase;

          if (!completedPhases.includes(phase.phase)) {
            completedPhases.push(phase.phase);

            // Extract current price from phase 1
            if (phase.phase === 1) {
              currentPrice = extractCurrentPrice(phase.raw);
            }

            // Save phase 2 raw for chart generation
            if (phase.phase === 2) {
              phase2Raw = phase.raw;
            }

            sendEvent('phase', {
              phase: phase.phase,
              title: phase.title,
              raw: phase.raw,
            });
          }

          buffer = result.remainder;
          result = detectPhaseBoundary(buffer);
        }
      },
      // onToolUse
      (name: string) => {
        sendEvent('progress', {
          message: `Searching the web for ${ticker} data...`,
          phase: completedPhases.length + 1,
        });
      },
      // onDone
      async () => {
        // Emit any remaining buffered content as the last phase
        if (buffer.trim()) {
          const lastPhaseMatch = buffer.match(/## Phase (\d+)[:\s—\-]+(.+?)(?:\n|$)/);
          if (lastPhaseMatch) {
            const phaseNum = parseInt(lastPhaseMatch[1], 10);
            if (!completedPhases.includes(phaseNum)) {
              sendEvent('phase', {
                phase: phaseNum,
                title: lastPhaseMatch[2].trim(),
                raw: buffer.trim(),
              });
              if (phaseNum === 1) {
                currentPrice = extractCurrentPrice(buffer);
              }
              if (phaseNum === 2) {
                phase2Raw = buffer;
              }
            }
          }
        }

        // Generate chart if we have phase 2 data
        let chartFilename: string | null = null;
        if (phase2Raw) {
          try {
            const chartParams = extractChartParams(phase2Raw, currentPrice || undefined);
            if (chartParams) {
              sendEvent('progress', { message: 'Generating candlestick chart...', phase: 'chart' });
              chartFilename = await generateChart(ticker, chartParams);
            }
          } catch (err: any) {
            sendEvent('error', { message: `Chart generation failed: ${err.message}` });
          }
        }

        sendEvent('done', {
          ticker,
          chartUrl: chartFilename ? `/chart/${chartFilename}` : null,
          phasesCompleted: completedPhases.length,
          fullText,
        });

        res.end();
      }
    );
  } catch (err: any) {
    sendEvent('error', { message: err.message || 'Analysis failed' });
    res.end();
  }
});

export default router;
