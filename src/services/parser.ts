import type { ChartParams } from '../types/analysis.js';

const PHASE_REGEX = /## Phase (\d+)[:\s—\-]+(.+?)(?:\n|$)/;

export interface ParsedPhase {
  phase: number;
  title: string;
  raw: string;
}

export function splitIntoPhases(fullText: string): ParsedPhase[] {
  const phases: ParsedPhase[] = [];
  const sections = fullText.split(/(?=## Phase \d)/);

  for (const section of sections) {
    const match = section.match(PHASE_REGEX);
    if (match) {
      phases.push({
        phase: parseInt(match[1], 10),
        title: match[2].trim(),
        raw: section.trim(),
      });
    }
  }

  return phases;
}

export function detectPhaseBoundary(buffer: string): {
  completedPhase: ParsedPhase | null;
  remainder: string;
} {
  // Look for the pattern: content followed by "---" or "## Phase N"
  // indicating a phase just completed
  const phaseStartPattern = /## Phase (\d+)[:\s—\-]+(.+?)(?:\n|$)/;
  const separatorPattern = /\n---\n/;
  const nextPhasePattern = /\n## Phase \d/;

  const match = buffer.match(phaseStartPattern);
  if (!match) {
    return { completedPhase: null, remainder: buffer };
  }

  // Check if there's a separator or next phase marker after content
  const afterHeader = buffer.substring(match.index! + match[0].length);
  const sepIdx = afterHeader.search(separatorPattern);
  const nextIdx = afterHeader.search(nextPhasePattern);

  let endIdx = -1;
  if (sepIdx >= 0 && nextIdx >= 0) {
    endIdx = Math.min(sepIdx, nextIdx);
  } else if (sepIdx >= 0) {
    endIdx = sepIdx;
  } else if (nextIdx >= 0) {
    endIdx = nextIdx;
  }

  if (endIdx >= 0) {
    const phaseContent = buffer.substring(match.index!, match.index! + match[0].length + endIdx);
    const remainder = buffer.substring(match.index! + match[0].length + endIdx);

    return {
      completedPhase: {
        phase: parseInt(match[1], 10),
        title: match[2].trim(),
        raw: phaseContent.trim(),
      },
      remainder: remainder.replace(/^\n---\n/, ''),
    };
  }

  return { completedPhase: null, remainder: buffer };
}

export function extractChartParams(phase2Raw: string, currentPrice?: number): ChartParams | null {
  try {
    const numbers = (pattern: RegExp): number[] => {
      const matches = phase2Raw.match(pattern);
      if (!matches) return [];
      return matches.map((m) => {
        const num = m.match(/[\d,.]+/);
        return num ? parseFloat(num[0].replace(/,/g, '')) : 0;
      }).filter((n) => n > 0);
    };

    // Extract bull target range
    const bullMatch = phase2Raw.match(/[Bb]ull(?:ish)?.*?[Tt]arget.*?\$?([\d,.]+)\s*[-–—to]+\s*\$?([\d,.]+)/);
    const bullLow = bullMatch ? parseFloat(bullMatch[1].replace(/,/g, '')) : 0;
    const bullHigh = bullMatch ? parseFloat(bullMatch[2].replace(/,/g, '')) : 0;

    // Extract bear target range
    const bearMatch = phase2Raw.match(/[Bb]ear(?:ish)?.*?[Tt]arget.*?\$?([\d,.]+)\s*[-–—to]+\s*\$?([\d,.]+)/);
    const bearLow = bearMatch ? parseFloat(bearMatch[1].replace(/,/g, '')) : 0;
    const bearHigh = bearMatch ? parseFloat(bearMatch[2].replace(/,/g, '')) : 0;

    // Extract support levels
    const supportMatches = phase2Raw.match(/[Ss]upport.*?\$?([\d,.]+)/g) || [];
    const supports = supportMatches
      .map((m) => {
        const n = m.match(/\$?([\d,.]+)/);
        return n ? parseFloat(n[1].replace(/,/g, '')) : 0;
      })
      .filter((n) => n > 0)
      .slice(0, 5);

    // Extract resistance levels
    const resistanceMatches = phase2Raw.match(/[Rr]esist(?:ance)?.*?\$?([\d,.]+)/g) || [];
    const resistances = resistanceMatches
      .map((m) => {
        const n = m.match(/\$?([\d,.]+)/);
        return n ? parseFloat(n[1].replace(/,/g, '')) : 0;
      })
      .filter((n) => n > 0)
      .slice(0, 5);

    if (!bullLow || !bullHigh || !bearLow || !bearHigh) return null;

    return {
      bullLow,
      bullHigh,
      bearLow,
      bearHigh,
      supports: supports.length ? supports : [bearHigh],
      resistances: resistances.length ? resistances : [bullLow],
      current: currentPrice || (bullLow + bearHigh) / 2,
    };
  } catch {
    return null;
  }
}

export function extractCurrentPrice(phase1Raw: string): number | null {
  // Look for patterns like "$152.30" or "Current price: $152" near the start
  const priceMatch = phase1Raw.match(/(?:[Cc]urrent\s*[Pp]rice|[Tt]rading\s*(?:at|around|near)|[Ll]ast\s*[Cc]lose)[:\s]*\$?([\d,.]+)/);
  if (priceMatch) {
    return parseFloat(priceMatch[1].replace(/,/g, ''));
  }

  // Fallback: first dollar amount in the text
  const firstPrice = phase1Raw.match(/\$([\d,.]+)/);
  if (firstPrice) {
    return parseFloat(firstPrice[1].replace(/,/g, ''));
  }

  return null;
}
