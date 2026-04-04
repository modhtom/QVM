import express from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateAdmin } from './adminAuth.js';
import { getMetricsSummary } from './metrics.js';
import { getDailyJobCounts, getPopularSurahs } from './db.js';
import { logger } from './logger.js';

const router = express.Router();
const logDir = 'Data/logs';

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

router.get('/logs', authenticateAdmin, (req, res) => {
  try {
    const type = req.query.type === 'error' ? 'error.log' : 'app.log';
    const numLines = parseInt(req.query.lines) || 50;

    const logFile = path.resolve(logDir, type);
    if (!fs.existsSync(logFile)) {
      return res.json({ logs: [] });
    }

    const fileBuffer = fs.readFileSync(logFile);
    const to_string = fileBuffer.toString();
    const split_lines = to_string.split("\n").filter(Boolean);

    const recent = split_lines.slice(Math.max(split_lines.length - numLines, 0));

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