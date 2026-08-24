import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../index.js'

let app: Express

beforeAll(() => {
  process.env.NODE_ENV = 'test'
  app = createApp()
})

afterAll(async () => {
  const { prisma } = await import('../lib/prisma.js')
  await prisma.$disconnect()
})

describe('app smoke', () => {
  it('serves /health without auth', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 401 for protected routes without a token', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401)
    expect((await request(app).get('/api/v1/trusts/096dd518-28fe-4b70-8ea9-2a6a0aea0252/donations')).status).toBe(401)
    expect((await request(app).get('/api/v1/trusts/096dd518-28fe-4b70-8ea9-2a6a0aea0252/audit-log')).status).toBe(401)
    expect((await request(app).post('/api/v1/trusts/096dd518-28fe-4b70-8ea9-2a6a0aea0252/my-donations')).status).toBe(401)
  })

  it('rejects malformed login bodies with 422', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email', password: '123' })
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('Validation failed')
  })

  it('rejects a weak registration password with 422', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email: 't@test.in', password: 'abc' })
    expect(res.status).toBe(422)
  })

  it('returns 404 for unknown routes', async () => {
    expect((await request(app).get('/api/v1/nope')).status).toBe(404)
  })
})