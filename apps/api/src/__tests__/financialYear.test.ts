import { describe, expect, it } from 'vitest'
import { currentFYWindow, fyWindowForDate, nextFYWindow, openFYWindow, windowDateFilter } from '../lib/financialYear.js'

const D = (s: string) => new Date(s)
const noConfig = {}

describe('financialYear default (Indian Apr 1 – Mar 31)', () => {
  it('maps a date before Apr 1 to the prior financial year', () => {
    const w = fyWindowForDate(noConfig, D('2026-02-15'))
    expect(w.label).toBe('2025-2026')
    expect(w.start.toISOString()).toBe('2025-04-01T00:00:00.000Z')
    expect(w.end.toISOString()).toBe('2026-03-31T00:00:00.000Z')
  })

  it('starts a new year exactly on Apr 1', () => {
    const w = fyWindowForDate(noConfig, D('2026-04-01'))
    expect(w.label).toBe('2026-2027')
    expect(w.end.toISOString()).toBe('2027-03-31T00:00:00.000Z')
  })

  it('keeps Mar 31 in the fiscal year before it jumps', () => {
    const w = fyWindowForDate(noConfig, D('2026-03-31T12:00:00.000Z'))
    expect(w.label).toBe('2025-2026')
  })

  it('handles leap-year boundaries', () => {
    expect(fyWindowForDate(noConfig, D('2024-02-29')).label).toBe('2023-2024')
    expect(fyWindowForDate(noConfig, D('2024-04-01')).label).toBe('2024-2025')
  })

  it('computes nextFYWindow', () => {
    const w = fyWindowForDate(noConfig, D('2026-09-10'))
    const next = nextFYWindow(noConfig, w)
    expect(next.label).toBe('2027-2028')
    expect(next.start.toISOString()).toBe('2027-04-01T00:00:00.000Z')
    expect(next.end.toISOString()).toBe('2028-03-31T00:00:00.000Z')
  })
})

describe('financialYear custom configured window', () => {
  const trust = { financialYearStartDate: '2026-08-16', financialYearEndDate: '2027-08-15' }

  it('anchors the window at the configured start', () => {
    const w = fyWindowForDate(trust, D('2026-08-16T10:00:00Z'))
    expect(w.label).toBe('2026-2027')
    expect(w.start.toISOString()).toBe('2026-08-16T00:00:00.000Z')
    expect(w.end.toISOString()).toBe('2027-08-15T00:00:00.000Z')
  })

  it('keeps the window through its final day', () => {
    const w = fyWindowForDate(trust, D('2027-08-15'))
    expect(w.label).toBe('2026-2027')
  })

  it('rolls to the next window the day after the end date', () => {
    const w = fyWindowForDate(trust, D('2027-08-16'))
    expect(w.label).toBe('2027-2028')
    expect(w.start.toISOString()).toBe('2027-08-16T00:00:00.000Z')
    expect(w.end.toISOString()).toBe('2028-08-14T00:00:00.000Z')
  })

  it('supports non-365-day windows', () => {
    const short = { financialYearStartDate: '2026-08-16', financialYearEndDate: '2026-12-31' }
    const first = fyWindowForDate(short, D('2026-12-31'))
    expect(first.label).toBe('2026-2026')
    const second = fyWindowForDate(short, D('2027-01-01'))
    expect(second.start.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(second.end.toISOString()).toBe('2027-05-18T00:00:00.000Z')
  })

  it('computes nextFYWindow for custom windows', () => {
    const w = fyWindowForDate(trust, D('2026-08-16'))
    expect(nextFYWindow(trust, w).start.toISOString()).toBe('2027-08-16T00:00:00.000Z')
  })
})

describe('financialYear openFYWindow (advance past the latest close)', () => {
  it('uses the date-derived window when nothing is closed', () => {
    expect(openFYWindow(noConfig, null)).toEqual(currentFYWindow(noConfig))
  })

  it('advances immediately past the closed window, even mid-window', () => {
    // Closing today's window (say 2026-2027) while real time is still inside it must
    // open the NEXT window straight away, not wait for its start date.
    const closed = fyWindowForDate(noConfig, new Date())
    const open = openFYWindow(noConfig, closed)
    expect(open.label).toBe(nextFYWindow(noConfig, closed).label)
    expect(open.start.getTime()).toBeGreaterThan(closed.end.getTime())
  })

  it('advances a custom window to the following configured window', () => {
    const trust = { financialYearStartDate: '2026-08-16', financialYearEndDate: '2027-08-15' }
    const closed = fyWindowForDate(trust, D('2026-09-01')) // 2026-2027
    const open = openFYWindow(trust, closed)
    expect(open.label).toBe('2027-2028')
    expect(open.start.toISOString()).toBe('2027-08-16T00:00:00.000Z')
    expect(open.end.toISOString()).toBe('2028-08-14T00:00:00.000Z')
  })

  it('keeps date-current ahead of a stale (old) close', () => {
    const closed = fyWindowForDate(noConfig, D('2023-01-01')) // 2022-2023
    const open = openFYWindow(noConfig, closed)
    expect(open.label).toBe(currentFYWindow(noConfig).label)
  })
})

describe('financialYear helpers', () => {
  it('currentFYWindow wraps fyWindowForDate with now', () => {
    const now = new Date()
    expect(currentFYWindow(noConfig).label).toBe(fyWindowForDate(noConfig, now).label)
  })

  it('windowDateFilter is inclusive of both ends', () => {
    const w = fyWindowForDate(noConfig, D('2026-05-01'))
    const f = windowDateFilter(w)
    expect(f.gte.toISOString()).toBe('2026-04-01T00:00:00.000Z')
    expect(f.lte.getTime()).toBe(w.end.getTime() + 86_400_000 - 1)
    expect(f.lte.toISOString()).toBe('2027-03-31T23:59:59.999Z')
  })

  it('treats UTC-midnight anchors and IST timestamps as the same local day', () => {
    // anchor stored as 2026-08-16T00:00:00Z collides with a donation at 00:30 IST
    const anchorWin = fyWindowForDate({ financialYearStartDate: '2026-08-16', financialYearEndDate: '2027-08-15' }, D('2026-08-16T00:30:00Z'))
    expect(anchorWin.label).toBe('2026-2027')
    // donation at IST 23:30 on 08-16 is 18:00 UTC on 08-16 → still 08-16 IST
    const lateWin = fyWindowForDate({ financialYearStartDate: '2026-08-16', financialYearEndDate: '2027-08-15' }, D('2026-08-16T18:00:00.000Z'))
    expect(lateWin.label).toBe('2026-2027')
    // donation at IST 00:30 on 08-17 is 19:00 UTC on 08-16 → counted on 08-17 IST,
    // which is still inside window A (it runs 2026-08-16 → 2027-08-15)
    const earlyWin = fyWindowForDate({ financialYearStartDate: '2026-08-16', financialYearEndDate: '2027-08-15' }, D('2026-08-16T19:00:00.000Z'))
    expect(earlyWin.label).toBe('2026-2027')
  })
})