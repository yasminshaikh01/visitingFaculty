const nodemailer = require('nodemailer');
const https = require('https');
require('dotenv').config();

// ── Determine email provider ──────────────────────────────────────
// If BREVO_API_KEY is set → use Brevo HTTP API (works on Railway, Render etc.)
// Otherwise → use SMTP/Nodemailer (works locally, on VPS)
const useBrevo = !!process.env.BREVO_API_KEY;

console.log('[EmailService] Provider:', useBrevo ? 'Brevo (HTTP API)' : 'SMTP (Nodemailer)');
if (useBrevo) {
    console.log('[EmailService] Config:', {
        apiKey: '****' + process.env.BREVO_API_KEY.slice(-6),
        fromEmail: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER,
        fromName: process.env.EMAIL_FROM_NAME || 'DAVV Visiting Faculty System'
    });
} else {
    console.log('[EmailService] Config:', {
        host: process.env.SMTP_HOST || '(not set)',
        port: process.env.SMTP_PORT || '(not set)',
        user: process.env.SMTP_USER || '(not set)',
        pass: process.env.SMTP_PASS ? '****' + process.env.SMTP_PASS.slice(-4) : '(not set)',
        secure: process.env.SMTP_SECURE || '(not set)'
    });
}

// ── SMTP Transporter (only created if not using Brevo) ────────────
let transporter = null;
if (!useBrevo) {
    if (process.env.SMTP_HOST === 'smtp.gmail.com') {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    } else {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: { rejectUnauthorized: false }
        });
    }
}

// ── Brevo HTTP API call (native https, no extra package) ──────────
function sendViaBrevo(options) {
    return new Promise((resolve, reject) => {
        const fromEmail = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
        const fromName = process.env.EMAIL_FROM_NAME || 'DAVV Visiting Faculty System';

        const toList = Array.isArray(options.to)
            ? options.to.map(email => ({ email }))
            : [{ email: options.to }];

        const body = JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: toList,
            subject: options.subject,
            htmlContent: options.html || undefined,
            textContent: options.text || undefined
        });

        const req = https.request({
            hostname: 'api.brevo.com',
            path: '/v3/smtp/email',
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, messageId: parsed.messageId, response: `Brevo OK (${res.statusCode})` });
                    } else {
                        resolve({ success: false, error: parsed.message || data, code: parsed.code });
                    }
                } catch (e) {
                    resolve({ success: false, error: `Brevo response parse error: ${data}` });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(body);
        req.end();
    });
}

// ── Test email connection ─────────────────────────────────────────
async function testEmailConnection() {
    try {
        console.log('[EmailService] Verifying connection...');
        if (useBrevo) {
            console.log('[EmailService] ✅ Brevo API key configured - ready to send');
            return { success: true, message: 'Brevo API key configured', provider: 'brevo' };
        } else {
            await transporter.verify();
            console.log('[EmailService] ✅ SMTP connection verified - ready to send');
            return { success: true, message: 'SMTP connection verified', provider: 'smtp' };
        }
    } catch (error) {
        console.error('[EmailService] ❌ Connection FAILED:', error.message);
        return { success: false, error: error.message, code: error.code };
    }
}

// ── Send email (auto-selects Brevo or SMTP) ───────────────────────
async function sendEmail(options) {
    try {
        console.log(`[EmailService] Sending via ${useBrevo ? 'Brevo' : 'SMTP'} to: ${options.to}, subject: "${options.subject}"`);

        if (useBrevo) {
            const result = await sendViaBrevo(options);
            if (result.success) {
                console.log(`[EmailService] 📧 Email sent via Brevo to ${options.to}: ${result.messageId}`);
            } else {
                console.error('[EmailService] ❌ Brevo error:', result.error);
            }
            return result;
        } else {
            const mailOptions = {
                from: `"DAVV Visiting Faculty System" <${process.env.SMTP_USER}>`,
                to: options.to,
                subject: options.subject,
                text: options.text || '',
                html: options.html || '',
                attachments: options.attachments || []
            };
            const info = await transporter.sendMail(mailOptions);
            console.log(`[EmailService] 📧 Email sent via SMTP to ${options.to}: ${info.messageId}`);
            return { success: true, messageId: info.messageId, response: info.response };
        }
    } catch (error) {
        console.error('[EmailService] ❌ Email sending failed:', {
            provider: useBrevo ? 'brevo' : 'smtp',
            to: options.to,
            errorMessage: error.message,
            errorCode: error.code
        });
        return { success: false, error: error.message };
    }
}

module.exports = { sendEmail, testEmailConnection };