import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { ROLE_LABELS, ROLE_ORDER, type TrustRole } from '@pavati/shared'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, Spinner, Badge, EmptyState, PageHeader } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'

export default function CommitteePage() {
  const active = useActiveTrust()!
  const { data, isLoading } = useQuery({
    queryKey: ['committee', active.trustId],
    queryFn: () => api.get<any[]>(`/trusts/${active.trustId}/committee`),
  })

  const committeeRoles: TrustRole[] = ['PRIMARY_ADMIN', 'ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'COMMITTEE_MEMBER']
  const members = data?.filter((m) => committeeRoles.includes(m.role)) ?? []

  return (
    <AppLayout>
      <PageHeader title="Committee" subtitle="The team running this trust" />
      {isLoading || !data ? <Spinner /> : members.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-6 w-6" />} title="No committee roles yet" description="Assign committee roles from the Members page." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_ORDER.filter((r) => committeeRoles.includes(r)).map((role) => {
            const holders = members.filter((m) => m.role === role)
            if (holders.length === 0) return null
            return (
              <Card key={role} className="p-5">
                <Badge color="maroon">{ROLE_LABELS[role]}</Badge>
                <div className="mt-3 space-y-2">
                  {holders.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-saffron-100 text-sm font-bold text-saffron-700">
                        {m.user.profileImage ? <img src={m.user.profileImage} alt="" className="h-full w-full object-cover" /> : m.user.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-800">{m.user.name}</p>
                        <p className="text-xs text-stone-400">{m.position ?? ROLE_LABELS[role]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}