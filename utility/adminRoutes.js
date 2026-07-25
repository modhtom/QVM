import express from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { authenticateAdmin } from './adminAuth.js';
import { getMetricsSummary } from './metrics.js';
import {
    getDailyJobCounts, getPopularSurahs,
    getAllUsers, banUser, unbanUser,
    getBannedEmails, addBannedEmail, removeBannedEmail,
    getBannedIps, addBannedIp, removeBannedIp,
    findUserById, createAuthToken, deleteAuthTokensForUser
} from './db.js';
import { sendVerificationEmail } from './email.js';
import crypto from 'crypto';
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

router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ users });
  } catch (err) {
    logger.error(`Error fetching users: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users/:id/ban', authenticateAdmin, async (req, res) => {
  try {
    await banUser(req.params.id);
    res.json({ success: true, message: 'User banned successfully' });
  } catch (err) {
    logger.error(`Error banning user: ${err.message}`);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:id/unban', authenticateAdmin, async (req, res) => {
  try {
    await unbanUser(req.params.id);
    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (err) {
    logger.error(`Error unbanning user: ${err.message}`);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

router.post('/users/:id/resend-verification', authenticateAdmin, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'User is already verified' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAtDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await deleteAuthTokensForUser(user.id, 'verify');
    await createAuthToken(user.id, verificationToken, 'verify', expiresAtDate);

    sendVerificationEmail(user.email, verificationToken).catch(err => logger.error(`Email error: ${err.message}`));

    res.json({ success: true, message: 'Verification email resent successfully' });
  } catch (err) {
    logger.error(`Error resending verification: ${err.message}`);
    res.status(500).json({ error: 'Failed to resend verification' });
  }
});

router.get('/bans/emails', authenticateAdmin, async (req, res) => {
  try {
    const emails = await getBannedEmails();
    res.json({ emails });
  } catch (err) {
    logger.error(`Error fetching banned emails: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch banned emails' });
  }
});

router.post('/bans/emails', authenticateAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: 'Email is required' });
    
    await addBannedEmail(email.toLowerCase());
    res.json({ success: true, message: 'Email banned' });
  } catch (err) {
    logger.error(`Error banning email: ${err.message}`);
    res.status(500).json({ error: 'Failed to ban email' });
  }
});

router.delete('/bans/emails/:email', authenticateAdmin, async (req, res) => {
  try {
    await removeBannedEmail(req.params.email.toLowerCase());
    res.json({ success: true, message: 'Email unbanned' });
  } catch (err) {
    logger.error(`Error unbanning email: ${err.message}`);
    res.status(500).json({ error: 'Failed to unban email' });
  }
});

router.get('/bans/ips', authenticateAdmin, async (req, res) => {
  try {
    const ips = await getBannedIps();
    res.json({ ips });
  } catch (err) {
    logger.error(`Error fetching banned IPs: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch banned IPs' });
  }
});

router.post('/bans/ips', authenticateAdmin, async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip)
      return res.status(400).json({ error: 'IP is required' });

    await addBannedIp(ip);
    res.json({ success: true, message: 'IP banned' });
  } catch (err) {
    logger.error(`Error banning IP: ${err.message}`);
    res.status(500).json({ error: 'Failed to ban IP' });
  }
});

router.delete('/bans/ips/:ip', authenticateAdmin, async (req, res) => {
  try {
    await removeBannedIp(req.params.ip);
    res.json({ success: true, message: 'IP unbanned' });
  } catch (err) {
    logger.error(`Error unbanning IP: ${err.message}`);
    res.status(500).json({ error: 'Failed to unban IP' });
  }
});

export default router;