import os from 'node:os'
import { monitorEventLoopDelay } from 'node:perf_hooks'

/**
 * Process-level runtime metrics for the developer console.
 *
 * Kept in its own module because the counters are process-global while the endpoint
 * that reads them lives on the dev router. A single dyno means these numbers describe
 * the whole app, which is what makes them worth surfacing.
 */

const requestTimestamps: number[] = []
const WINDOW_MS = 60_000
let totalRequests = 0

/** Records one served request. Called from the global middleware chain. */
export function recordRequest(): void {
  const now = Date.now()
  totalRequests++
  requestTimestamps.push(now)
  // Prune lazily: the array only ever holds the trailing minute.
  const cutoff = now - WINDOW_MS
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift()
  }
}

const loopDelay = monitorEventLoopDelay({ resolution: 20 })
loopDelay.enable()

function bytesToMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

/** "3d 4h 12m" — days only appear once there are any. */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${Math.floor(seconds % 60)}s`
}

/** Percentage of one core used, averaged across all cores. */
function cpuPercent(): number {
  const usage = process.cpuUsage()
  const elapsed = process.uptime() * 1000_000
  if (elapsed <= 0) return 0
  const used = usage.user + usage.system
  return Math.min(100, Math.round((used / elapsed) * 100))
}

export async function collectHealth(dbProbe: () => Promise<void>) {
  const mem = process.memoryUsage()
  const cpu = os.cpus()

  // A database round-trip is the signal most likely to matter when a single dyno is
  // struggling. Failure is reported, never thrown, so the endpoint still answers.
  const dbStart = performance.now()
  let dbOk = true
  try {
    await dbProbe()
  } catch {
    dbOk = false
  }
  const dbLatencyMs = Math.round((performance.now() - dbStart) * 10) / 10

  const now = Date.now()
  const cutoff = now - WINDOW_MS
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift()
  }

  return {
    uptimeSeconds: Math.floor(process.uptime()),
    uptime: formatUptime(process.uptime()),
    memoryMb: {
      rss: bytesToMb(mem.rss),
      heapUsed: bytesToMb(mem.heapUsed),
      heapTotal: bytesToMb(mem.heapTotal),
      external: bytesToMb(mem.external),
    },
    cpuPercent: cpuPercent(),
    eventLoopDelayMs: Math.round((loopDelay.mean / 1e6) * 100) / 100,
    activeResources: process.getActiveResourcesInfo().length,
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    requests: { total: totalRequests, perMin: requestTimestamps.length },
    host: {
      cpus: cpu.length,
      loadAvg: cpu.length ? Math.round((os.loadavg()[0] / cpu.length) * 100) / 100 : 0,
      totalMemMb: bytesToMb(os.totalmem()),
      freeMemMb: bytesToMb(os.freemem()),
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    },
  }
}

export type HealthSnapshot = Awaited<ReturnType<typeof collectHealth>>
