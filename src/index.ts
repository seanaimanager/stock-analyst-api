import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter from './routes/analyze.js';
import chartRouter from './routes/chart.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// Routes
app.use(analyzeRouter);
app.use(chartRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stock Analyst API running on http://0.0.0.0:${PORT}`);
  console.log(`  POST /analyze  — stream stock analysis via SSE`);
  console.log(`  POST /chart    — generate candlestick chart`);
  console.log(`  GET  /chart/:f — serve generated chart`);
});
