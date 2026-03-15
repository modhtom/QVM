import axios from 'axios';
import { logger } from './logger.js';

export async function sendWebhookNotification(event, payload) {
  const webhookUrl = process.env.WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  try {
    let postData = {
      event,
      timestamp: new Date().toISOString(),
      payload
    };

    if (webhookUrl.includes('discord.com/api/webhooks')) {
      const colorMap = {
        'SERVER_STARTED': 3066993, // Green
        'API_ERROR': 15158332,     // Red
        'GLOBAL_ERROR': 15158332,  // Red
        'JOB_COMPLETED': 3447003,  // Blue
        'JOB_FAILED': 15158332     // Red
      };

      postData = {
        username: "QVM System",
        embeds: [{
          title: `System Event: ${event}`,
          color: colorMap[event] || 9807270,
          description: "```json\n" + JSON.stringify(payload, null, 2) + "\n```",
          timestamp: new Date().toISOString()
        }]
      };
    }

    await axios.post(webhookUrl, postData, {
      timeout: 5000
    });
    logger.info(`Webhook sent for event: ${event}`);
  } catch (error) {
    logger.error(`Failed to send webhook for event ${event}: ${error.message}`);
  }
}
