import fs from 'fs/promises';
import path from 'path';

const LOG_DIR  = path.join(process.cwd(), 'logs', 'schedule_logs');
const LOG_FILE = path.join(LOG_DIR, 'schedule.log');

function now(): string {
  return new Date().toISOString();
}

function pad(label: string, width = 10): string {
  return label.padEnd(width);
}

async function append(line: string): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.appendFile(LOG_FILE, line + '\n', 'utf-8');
}

export const ScheduleLogger = {

  // Called immediately when CLI starts — before any delay
  async logTriggered(scheduleEnabled: boolean, intervalHours: number): Promise<void> {
    const line = `[${now()}]  ${pad('TRIGGERED')} | schedule=${scheduleEnabled ? 'ON ' : 'OFF'} | interval=${intervalHours}h`;
    await append(line);
  },

  // Called when random delay kicks in
  async logDelay(delayMins: number, intervalHours: number): Promise<void> {
    const runAt = new Date(Date.now() + delayMins * 60 * 1000).toISOString();
    const line = `[${now()}]  ${pad('WAITING')}  | delay=${delayMins}min | will_run_at=${runAt}`;
    await append(line);
  },

  // Called when the pipeline actually starts (after delay)
  async logRunStart(): Promise<void> {
    const line = `[${now()}]  ${pad('RUN START')}`;
    await append(line);
  },

  // Called when pipeline completes
  async logRunResult(result: {
    status: 'success' | 'error';
    durationMs: number;
    contentPieces: number;
    ideasGenerated: number;
    sourcesUsed: string[];
    imagePath: string | null;
    error?: string;
  }): Promise<void> {
    const secs = (result.durationMs / 1000).toFixed(1);
    const image = result.imagePath ? 'YES' : 'NO';

    if (result.status === 'success') {
      const line =
        `[${now()}]  ${pad('SUCCESS')}  | duration=${secs}s` +
        ` | posts=${result.contentPieces}` +
        ` | ideas=${result.ideasGenerated}` +
        ` | sources=${result.sourcesUsed.join(',')}` +
        ` | image=${image}`;
      await append(line);
    } else {
      const line =
        `[${now()}]  ${pad('FAIL')}     | duration=${secs}s | error=${result.error || 'unknown'}`;
      await append(line);
    }

    // Blank separator between runs for readability
    await append('');
  },
};
