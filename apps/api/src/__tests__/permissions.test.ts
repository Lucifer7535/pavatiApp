import { describe, expect, it } from 'vitest'
import { permissionsForRole, ROLE_PERMISSIONS, ALL_PERMISSIONS } from '@pavati/shared'

describe('ROLE_PERMISSIONS', () => {
  it('primary admin gets every permission', () => {
    expect(ROLE_PERMISSIONS.PRIMARY_ADMIN).toEqual(ALL_PERMISSIONS)
  })

  it('collector can create donations and receipts but not manage templates or audit', () => {
    const p = permissionsForRole('COLLECTOR')
    expect(p).toContain('donation:create')
    expect(p).toContain('receipt:create')
    expect(p).not.toContain('template:manage')
    expect(p).not.toContain('audit:view')
    expect(p).not.toContain('donation:view')
  })

  it('committee roles view all donations; members and volunteers only their own', () => {
    for (const role of ['TREASURER', 'SECRETARY', 'PRESIDENT', 'ADMIN'] as const) {
      const p = permissionsForRole(role)
      expect(p).toContain('donation:view')
      expect(p).toContain('receipt:view')
      expect(p).toContain('announcement:view')
    }
    for (const role of ['MEMBER', 'VOLUNTEER'] as const) {
      const p = permissionsForRole(role)
      expect(p).not.toContain('donation:view')
      expect(p).toContain('donation:view_own')
      expect(p).toContain('receipt:view')
      expect(p).toContain('announcement:view')
      expect(p).toContain('donate')
    }
    const collector = permissionsForRole('COLLECTOR')
    expect(collector).not.toContain('donation:view')
    expect(collector).not.toContain('donation:view_own')
    expect(collector).toContain('receipt:view')
    expect(collector).toContain('receipt:create')
  })

  it('only admin roles can manage templates', () => {
    expect(permissionsForRole('ADMIN')).toContain('template:manage')
    expect(permissionsForRole('TREASURER')).not.toContain('template:manage')
    expect(permissionsForRole('SECRETARY')).not.toContain('template:manage')
  })

  it('falls back to the everyone set for unknown roles', () => {
    expect(permissionsForRole('GHOST' as never)).toContain('trust:view')
    expect(permissionsForRole('GHOST' as never)).not.toContain('template:manage')
  })
})