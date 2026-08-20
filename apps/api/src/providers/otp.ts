import crypto from 'node:crypto'
import { config } from '../config/index.js'

export interface OtpProvider {
  generate(): string
  send(phone: string, otp: string): Promise<{ ok: boolean; devCode?: string }>
}

class MockOtpProvider implements OtpProvider {
  generate(): string {
    return crypto.randomInt(100000, 999999).toString()
  }

  async send(_phone: string, otp: string) {
    if (config.mockMode) {
      return { ok: true, devCode: otp }
    }
    return { ok: true }
  }
}

export const otpProvider: OtpProvider = new MockOtpProvider()