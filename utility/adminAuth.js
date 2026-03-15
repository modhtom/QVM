import { logger } from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

export function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    logger.warn(`Unauthorized admin access attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Admin credentials required' });
  }

  if (authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      req.isAdmin = true;
      return next();
    }
  }

  logger.warn(`Invalid admin credentials used from ${req.ip}`);
  res.status(403).json({ error: 'Forbidden: Invalid Admin Credentials' });
}
