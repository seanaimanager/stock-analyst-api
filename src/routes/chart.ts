import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateChart, getChartPath } from '../services/chart.js';

const router = Router();

const chartRequestSchema = z.object({
  ticker: z.string().min(1).max(10),
  bullLow: z.number(),
  bullHigh: z.number(),
  bearLow: z.number(),
  bearHigh: z.number(),
  supports: z.array(z.number()),
  resistances: z.array(z.number()),
  current: z.number(),
});

// Generate a new chart
router.post('/chart', async (req: Request, res: Response) => {
  const parsed = chartRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const filename = await generateChart(parsed.data.ticker, parsed.data);
    res.json({ chartUrl: `/chart/${filename}`, filename });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve a generated chart
router.get('/chart/:filename', (req: Request<{ filename: string }>, res: Response) => {
  const filename = req.params.filename as string;

  // Sanitize filename
  if (!/^[A-Z0-9_\-]+\.png$/i.test(filename)) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  const chartPath = getChartPath(filename);
  if (!chartPath) {
    res.status(404).json({ error: 'Chart not found' });
    return;
  }

  res.sendFile(chartPath);
});

export default router;
