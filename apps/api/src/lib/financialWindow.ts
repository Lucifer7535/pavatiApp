import { prisma } from './prisma.js'
import { openFYWindow, type FYWindow, type FYConfigurable } from './financialYear.js'

/** The most recently closed window's FYWindow shape, or null when nothing is closed yet. */
export async function latestClosedWindow(trustId: string): Promise<FYWindow | null> {
  const latest = await prisma.financialYearClose.findFirst({
    where: { trustId },
    orderBy: { startDate: 'desc' },
  })
  return latest ? { label: latest.year, start: latest.startDate, end: latest.endDate } : null
}

/** The trust's active/open financial year (advances immediately past the latest close). */
export async function openWindowForTrust(trustId: string, trust: FYConfigurable): Promise<FYWindow> {
  return openFYWindow(trust, await latestClosedWindow(trustId))
}