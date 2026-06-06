import express from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { authenticateAdmin } from './adminAuth.js';
import { getMetricsSummary } from './metrics.js';
import { getDailyJobCounts, getPopularSurahs } from './db.js';
import { logger } from './logger.js';

const router = express.Router();
const logDir = 'Data/logs';

async function readLastLines(filePath, maxLines) {
  let fileHandle;
  try {
    fileHandle = await fsPromises.open(filePath, 'r');
    const stat = await fileHandle.stat();
    const fileSize = stat.size;
    if (fileSize === 0) return [];

    const CHUNK_SIZE = 16 * 1024;
    let buffer = Buffer.alloc(CHUNK_SIZE);
    let lines = [];
    let leftover = '';
    let position = fileSize;

    while (position > 0 && lines.length <= maxLines) {
      const bytesToRead = Math.min(position, CHUNK_SIZE);
      position -= bytesToRead;

      const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, position);
      const chunkStr = buffer.toString('utf8', 0, bytesRead) + leftover;
      const chunkLines = chunkStr.split('\n');
      leftover = chunkLines[0];
      const completedLines = chunkLines.slice(1);
      lines = completedLines.concat(lines);
    }

    if (leftover) {
      lines.unshift(leftover);
    }

    const filteredLines = lines.filter(Boolean);
    return filteredLines.slice(Math.max(filteredLines.length - maxLines, 0));
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}

router.post('/login', authenticateAdmin, (req, res) => {
  logger.info(`Admin login successful from ${req.ip}`);
  res.json({ success: true, message: 'Logged in successfully as admin' });
});

router.get('/metrics', authenticateAdmin, async (req, res) => {
  try {
    const data = await getMetricsSummary();
    res.json(data);
  } catch (err) {
    logger.error(`Error fetching metrics: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

router.get('/analytics/charts', authenticateAdmin, async (req, res) => {
  try {
    const [dailyJobs, popularSurahs] = await Promise.all([
      getDailyJobCounts(),
      getPopularSurahs()
    ]);
    res.json({ dailyJobs, popularSurahs });
  } catch (err) {
    logger.error(`Error fetching chart data: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

router.get('/logs', authenticateAdmin, async (req, res) => {
  try {
    const type = req.query.type === 'error' ? 'error.log' : 'app.log';
    const numLines = parseInt(req.query.lines) || 50;

    const logFile = path.resolve(logDir, type);
    if (!fs.existsSync(logFile)) {
      return res.json({ logs: [] });
    }

    const recent = await readLastLines(logFile, numLines);
    const parsedLogs = recent.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return { message: line };
      }
    });

    res.json({ logs: parsedLogs });
  } catch (err) {
    logger.error(`Error reading logs: ${err.message}`);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

export default router;