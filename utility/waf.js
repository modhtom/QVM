import { getBannedIps } from './db.js';
import { logger } from './logger.js';

const SQLI_REGEX = /(union.*select|select.*from|insert.*into|drop.*table|update.*set|delete.*from|--|#|\/\*|\*\/|@@version|waitfor.*delay)/i;
const XSS_REGEX = /(<script.*?>.*?<\/script>|javascript:|onerror=|onload=|eval\(|document\.cookie)/i;

export async function wafMiddleware(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress;
        const bannedIps = await getBannedIps();
        if (bannedIps.includes(clientIp)) {
            logger.warn(`WAF [IP_BANNED]: Blocked request from banned IP: ${clientIp} on ${req.originalUrl}`);
            return res.status(403).json({ error: 'Access denied.' });
        }

        const checkPayload = (payload) => {
            if (!payload) return false;
            let str = '';
            if (typeof payload === 'object') {
                try { str = JSON.stringify(payload); } catch (e) { return false; }
            } else {
                str = String(payload);
            }
            if (SQLI_REGEX.test(str)) return 'SQL Injection';
            if (XSS_REGEX.test(str)) return 'Cross-Site Scripting (XSS)';
            return false;
        };

        let threat = checkPayload(req.query);
        if (!threat)
            threat = checkPayload(req.body);

        if (threat) {
            logger.warn(`WAF [${threat}]: Blocked request from ${clientIp} on ${req.originalUrl}. Payload matched malicious pattern.`);
            return res.status(403).json({ error: 'Malicious request blocked.' });
        }
        next();
    } catch (err) {
        logger.error(`WAF Error: ${err.message}`);
        next();
    }
}
