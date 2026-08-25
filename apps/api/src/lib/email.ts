import { config } from '../config/index.js'
import { logger } from './logger.js'

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<boolean> {
  if (!config.resendApiKey) {
    logger.warn('Resend API key not configured — email not sent')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.resendFromEmail,
        to: [to],
        subject,
        html,
        text,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      logger.error({ status: res.status, body }, 'Resend email failed')
      return false
    }

    logger.info({ to, subject }, 'Email sent via Resend')
    return true
  } catch (err) {
    logger.error({ err }, 'Resend email error')
    return false
  }
}
