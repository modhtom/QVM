import dotenv from 'dotenv';

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'QVM <onboarding@resend.dev>';
const APP_URL = (process.env.APP_URL || 'http://localhost:7860').replace(/\/+$/, '');

if (!RESEND_API_KEY) {
    console.warn('[Email] WARNING: RESEND_API_KEY is not set. Email sending will be disabled.');
}

function getEmailTemplate(title, message, buttonText, buttonLink) {
    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin:0; padding:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif; background-color:#f8faf9; color:#1a2e1a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8faf9; padding:40px 20px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:24px; border:1px solid #e0e8e5; box-shadow:0 8px 25px rgba(26,77,58,0.12); overflow:hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background:linear-gradient(135deg,#1a4d3a 0%,#2d7d5a 100%); padding:40px 30px; text-align:center;">
                                <h1 style="margin:0; font-size:36px; font-weight:700; color:#ffffff; letter-spacing:4px;">QVM</h1>
                                <p style="margin:10px 0 0; font-family:'Amiri',serif; font-size:18px; color:#d4af37; direction:rtl;">صانع فيديو القرآن الكريم</p>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding:40px 30px; text-align:center;">
                                <h2 style="margin:0 0 20px; font-size:22px; font-weight:600; color:#1a4d3a;">${title}</h2>
                                <p style="font-size:16px; line-height:1.7; color:#4a5e4a; margin-bottom:30px;">${message}</p>
                                <a href="${buttonLink}" style="display:inline-block; padding:16px 40px; background:linear-gradient(135deg,#d4af37 0%,#f4d03f 100%); color:#1a2e1a; text-decoration:none; border-radius:50px; font-weight:600; font-size:16px; letter-spacing:1px; text-transform:uppercase; box-shadow:0 8px 25px rgba(26,77,58,0.12);">${buttonText}</a>
                                <p style="margin-top:30px; font-size:13px; color:#4a5e4a; font-style:italic;">إذا لم تطلب هذا الإجراء، يمكنك تجاهل هذه الرسالة بأمان.</p>
                            </td>
                        </tr>
                        <!-- Divider -->
                        <tr>
                            <td style="padding:0 30px;">
                                <div style="height:2px; background:linear-gradient(135deg,#d4af37 0%,#f4d03f 100%); border-radius:2px;"></div>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding:20px 30px; text-align:center;">
                                <p style="font-size:12px; color:#4a5e4a; margin:0;">&copy; ${new Date().getFullYear()} QVM. جميع الحقوق محفوظة.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

async function sendEmail(to, subject, html) {
    if (!RESEND_API_KEY) {
        console.error('[Email] Cannot send email: RESEND_API_KEY is not configured.');
        console.log('[Email] DEBUG: Would have sent email to:', to, '| Subject:', subject);
        return false;
    }

    console.log(`[Email] Sending email to ${to} | Subject: "${subject}" | From: ${FROM_EMAIL}`);

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [to],
                subject: subject,
                html: html,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`[Email] Resend API Error (${response.status}):`, JSON.stringify(data));
            return false;
        }

        console.log(`[Email] Successfully sent to ${to} | Resend ID: ${data.id}`);
        return true;
    } catch (error) {
        console.error('[Email] Network error sending email:', error.message);
        return false;
    }
}

export async function sendVerificationEmail(toEmail, token) {
    const verifyLink = `${APP_URL}/api/auth/verify-email?token=${token}`;
    const html = getEmailTemplate(
        'Verify your Email Address',
        'Thank you for signing up! Please verify your email address to access all features of our platform.',
        'Verify Email',
        verifyLink
    );

    return sendEmail(toEmail, 'Verify your email - QVM', html);
}

export async function sendPasswordResetEmail(toEmail, token) {
    const resetLink = `${APP_URL}/?token=${token}`;
    const html = getEmailTemplate(
        'Reset your Password',
        'We received a request to reset your password. Click the button below to choose a new one. This link will expire in 1 hour.',
        'Reset Password',
        resetLink
    );

    return sendEmail(toEmail, 'Password Reset Request - QVM', html);
}
