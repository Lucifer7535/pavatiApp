import { IST_OFFSET_HOURS } from '../config/index.js'

const DAY_MS = 86_400_000

/**
 * A closed donation-window. `start`/`end` are UTC-midnight reference dates that
 * represent local (IST) calendar days, and the window is inclusive of both ends.
 */
export interface FYWindow {
  label: string
  start: Date
  end: Date
}

export type FYConfigurable = {
  financialYearStartDate?: Date | string | null
  financialYearEndDate?: Date | string | null
}

/**
 * Collapses any timestamp to its IST calendar day, re-referenced as UTC midnight.
 *
 * This single rule is safe for both inputs it sees: anchor dates arrive as UTC
 * midnight (`new Date('2026-08-16')`), where +5:30 stays on the same calendar day,
 * and donation timestamps carry real IST wall-clock times that need the shift.
 */
function toLocalDay(ref: Date): Date {
  const local = new Date(ref.getTime() + IST_OFFSET_HOURS * 60 * 60 * 1000)
  return new Date(`${local.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

function labelFor(start: Date, end: Date): string {
  return `${start.getUTCFullYear()}-${end.getUTCFullYear()}`
}

function indianFYWindowForDay(day: Date): FYWindow {
  const startYear = day.getUTCFullYear() - (day.getUTCMonth() >= 3 ? 0 : 1)
  const start = new Date(Date.UTC(startYear, 3, 1)) // Apr 1
  const end = new Date(Date.UTC(startYear + 1, 3, 0)) // Mar 31 inclusive
  return { label: labelFor(start, end), start, end }
}

/** The trust's configured anchor window, or null when it uses the default FY. */
export function configuredFYWindow(trust: FYConfigurable): { start: Date; end: Date } | null {
  if (!trust.financialYearStartDate || !trust.financialYearEndDate) return null
  return { start: toLocalDay(new Date(trust.financialYearStartDate)), end: toLocalDay(new Date(trust.financialYearEndDate)) }
}

/** The financial year a given date falls in, under the trust's window rule. */
export function fyWindowForDate(trust: FYConfigurable, date: Date): FYWindow {
  const day = toLocalDay(date)
  const config = configuredFYWindow(trust)
  if (!config) return indianFYWindowForDay(day)

  const lengthDays = Math.round((config.end.getTime() - config.start.getTime()) / DAY_MS) + 1
  const offsetDays = Math.floor((day.getTime() - config.start.getTime()) / DAY_MS)
  const k = Math.floor(offsetDays / lengthDays)
  const start = addDays(config.start, k * lengthDays)
  const end = addDays(start, lengthDays - 1)
  return { label: labelFor(start, end), start, end }
}

/** The financial year containing today. */
export function currentFYWindow(trust: FYConfigurable): FYWindow {
  return fyWindowForDate(trust, new Date())
}

/**
 * The trust's active/open financial year.
 *
 * When a window has been closed, the books advance to the window that follows the
 * most recent close immediately — so closing 2026-2027 while real time is still
 * inside that window opens 2027-2028 for dashboard/report defaults. With nothing
 * closed, the open year is simply the one containing today. Taking the later of
 * the two also survives the edge case where real time has already passed the
 * next window (a skipped, never-closed year stays behind an open one).
 */
export function openFYWindow(trust: FYConfigurable, latestClosed: FYWindow | null): FYWindow {
  if (!latestClosed) return currentFYWindow(trust)
  const next = nextFYWindow(trust, latestClosed)
  return next.start.getTime() > currentFYWindow(trust).start.getTime() ? next : currentFYWindow(trust)
}

/** The window that immediately follows a given window. */
export function nextFYWindow(trust: FYConfigurable, window: FYWindow): FYWindow {
  const config = configuredFYWindow(trust)
  if (!config) {
    return {
      label: `${window.start.getUTCFullYear() + 1}-${window.end.getUTCFullYear() + 1}`,
      start: new Date(Date.UTC(window.start.getUTCFullYear() + 1, window.start.getUTCMonth(), window.start.getUTCDate())),
      end: new Date(Date.UTC(window.end.getUTCFullYear() + 1, window.end.getUTCMonth(), window.end.getUTCDate())),
    }
  }
  const lengthDays = Math.round((config.end.getTime() - config.start.getTime()) / DAY_MS) + 1
  const start = addDays(window.start, lengthDays)
  const end = addDays(start, lengthDays - 1)
  return { label: labelFor(start, end), start, end }
}

/** Inclusive `donationDate` filter for a window. */
export function windowDateFilter(window: FYWindow): { gte: Date; lte: Date } {
  return { gte: window.start, lte: new Date(window.end.getTime() + DAY_MS - 1) }
}