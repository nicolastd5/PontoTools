// Serviço de envio de email via Outlook (SMTP Office365)
const nodemailer = require('nodemailer');
const logger     = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.office365.com',
  port:   parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false, // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    ciphers: 'SSLv3',
  },
});

/**
 * Envia email de recuperação de senha.
 * @param {string} toEmail - email do destinatário
 * @param {string} resetUrl - URL completa com o token de reset
 */
async function sendPasswordResetEmail(toEmail, resetUrl) {
  const from = process.env.EMAIL_FROM || `"Ponto Eletrônico" <${process.env.EMAIL_USER}>`;

  await transporter.sendMail({
    from,
    to:      toEmail,
    subject: 'Recuperação de senha — Ponto Eletrônico',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="display:inline-flex;width:52px;height:52px;background:#1d4ed8;border-radius:12px;align-items:center;justify-content:center">
            <span style="color:#fff;font-size:26px;font-weight:800">P</span>
          </div>
          <h1 style="font-size:20px;color:#0f172a;margin:12px 0 4px">Ponto Eletrônico</h1>
        </div>

        <div style="background:#fff;border-radius:10px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
          <h2 style="font-size:16px;color:#0f172a;margin:0 0 12px">Redefinição de senha</h2>
          <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px">
            Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para continuar.
            O link expira em <strong>1 hora</strong>.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                    padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
            Redefinir senha
          </a>
          <p style="font-size:12px;color:#94a3b8;margin:20px 0 0;line-height:1.5">
            Se você não solicitou a redefinição, ignore este email. Sua senha não será alterada.
            <br>Link: <span style="word-break:break-all">${resetUrl}</span>
          </p>
        </div>
      </div>
    `,
  });

  logger.info('Email de recuperação enviado', { to: toEmail });
}

module.exports = { sendPasswordResetEmail };
