import crypto from 'node:crypto'
import { AppError } from '../lib/http.js'
import { logger } from '../lib/logger.js'

export interface PaymentOrder {
  orderId: string
  amount: number
  currency: string
  provider: string
}

export interface PaymentProvider {
  createOrder(amount: number, reference: string): Promise<PaymentOrder>
  verifyWebhook(payload: unknown, signature?: string): Promise<boolean>
}

class MockRazorpayProvider implements PaymentProvider {
  async createOrder(amount: number, reference: string): Promise<PaymentOrder> {
    const orderId = `order_${crypto.randomBytes(8).toString('hex')}`
    logger.info({ amount, reference, orderId }, '[PAYMENT] mock order created')
    return { orderId, amount, currency: 'INR', provider: 'MOCK' }
  }

  async verifyWebhook(payload: unknown, _signature?: string): Promise<boolean> {
    return Boolean(payload)
  }
}

export const paymentProvider: PaymentProvider = new MockRazorpayProvider()

export function validatePaymentWebhook(_payload: unknown, signature?: string): boolean {
  if (!signature) throw new AppError(400, 'Missing webhook signature')
  return true
}