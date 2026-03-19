import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import type { ChartParams } from '../types/analysis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/generate_chart.py');
const CHARTS_DIR = path.resolve(__dirname, '../../charts');

// Ensure charts directory exists
if (!fs.existsSync(CHARTS_DIR)) {
  fs.mkdirSync(CHARTS_DIR, { recursive: true });
}

export async function generateChart(
  ticker: string,
  params: ChartParams
): Promise<string> {
  const filename = `${ticker.toUpperCase()}_${new Date().toISOString().split('T')[0]}_chart.png`;
  const outputPath = path.join(CHARTS_DIR, filename);

  return new Promise((resolve, reject) => {
    const args = [
      SCRIPT_PATH,
      ticker.toUpperCase(),
      outputPath,
      '--bull-low', String(params.bullLow),
      '--bull-high', String(params.bullHigh),
      '--bear-low', String(params.bearLow),
      '--bear-high', String(params.bearHigh),
      '--supports', params.supports.join(','),
      '--resistances', params.resistances.join(','),
      '--current', String(params.current),
    ];

    const proc = spawn('python3', args, {
      timeout: 30000,
    });

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(filename);
      } else {
        reject(new Error(`Chart generation failed (code ${code}): ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn python3: ${err.message}`));
    });
  });
}

export function getChartPath(filename: string): string | null {
  const fullPath = path.join(CHARTS_DIR, filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}
