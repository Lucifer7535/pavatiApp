import { describe, expect, it } from 'vitest'
import { assertNotLocked, recordLoginFailure, resetLoginFailures } from '../middleware/rateLimit.js'

describe('login lockout scoping', () => {
  it('does not let one caller lock a victim out account-wide', () => {
    const victim = 'victim@example.com'
    // Attacker exhausts the per-pair counter from their own address.
    for (let i = 0; i < 5; i++) recordLoginFailure('10.0.0.1', victim)
    // Attacker is now locked out.
    expect(() => assertNotLocked('10.0.0.1', victim)).toThrow(/Too many failed attempts/)
    // The victim, logging in from their own address, is unaffected.
    expect(() => assertNotLocked('10.0.0.9', victim)).not.toThrow()
  })

  it('still locks the offending caller out', () => {
    const email = 'target@example.com'
    for (let i = 0; i < 5; i++) recordLoginFailure('10.0.0.5', email)
    expect(() => assertNotLocked('10.0.0.5', email)).toThrow()
  })

  it('bounds spraying across many accounts from one host', () => {
    const ip = '10.0.0.77'
    for (let i = 0; i < 25; i++) recordLoginFailure(ip, `victim${i}@example.com`)
    expect(() => assertNotLocked(ip, 'never-seen@example.com')).toThrow(/Too many failed attempts/)
  })

  it('clears on success', () => {
    const ip = '10.0.0.3'
    const email = 'ok@example.com'
    for (let i = 0; i < 4; i++) recordLoginFailure(ip, email)
    resetLoginFailures(ip, email)
    expect(() => assertNotLocked(ip, email)).not.toThrow()
  })
})
