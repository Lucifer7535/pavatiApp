import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'

process.env.NODE_ENV = 'test'
process.env.MOCK_MODE = 'false'
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id.apps.googleusercontent.com'

describe('google auth', () => {
  let app: Express

  beforeAll(async () => {
    const { createApp } = await import('../index.js')
    app = createApp()
  })

  afterAll(async () => {
    const { prisma } = await import('../lib/prisma.js')
    await prisma.$disconnect()
  })

  it('rejects an invalid id token with 401 when mock mode is off', async () => {
    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'not-a-real-token' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid Google token')
  })

  it('rejects a malformed body with 422', async () => {
    const res = await request(app).post('/api/v1/auth/google').send({})
    expect(res.status).toBe(422)
  })
})
