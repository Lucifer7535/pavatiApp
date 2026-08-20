import { config } from '../config/index.js'
import { logger } from '../lib/logger.js'

export interface SendResult {
  ok: boolean
  providerResponse: string | null
}

export interface MessageSender {
  send(to: string, message: string, receiptLink?: string): Promise<SendResult>
}

export class MockSmsProvider implements MessageSender {
  async send(to: string, message: string, _receiptLink?: string): Promise<SendResult> {
    logger.info({ to, message }, '[SMS] mock message')
    return { ok: true, providerResponse: `mock-sms-id-${Date.now()}` }
  }
}

export class MockWhatsAppProvider implements MessageSender {
  async send(to: string, message: string, _receiptLink?: string): Promise<SendResult> {
    const waLink = `https://wa.me/91${to.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    logger.info({ to, waLink }, '[WHATSAPP] mock message')
    return { ok: true, providerResponse: waLink }
  }
}

export class MockEmailProvider implements MessageSender {
  async send(to: string, message: string, _receiptLink?: string): Promise<SendResult> {
    logger.info({ to, message }, '[EMAIL] mock message')
    return { ok: true, providerResponse: `mock-email-id-${Date.now()}` }
  }
}

export const smsProvider: MessageSender = new MockSmsProvider()
export const whatsappProvider: MessageSender = new MockWhatsAppProvider()
export const emailProvider: MessageSender = new MockEmailProvider()

export function isMockMode(): boolean {
  return config.mockMode
}