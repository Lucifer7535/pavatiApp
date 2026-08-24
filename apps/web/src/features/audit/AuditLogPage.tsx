import { useQuery } from '@tanstack/react-query'
import { FileClock } from 'lucide-react'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, Spinner, Badge, PageHeader, EmptyState } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { timeAgo } from '../../lib/utils'

export default function AuditLogPage() {
  const active = useActiveTrust()!
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', active.trustId],
    queryFn: () => api.get<any[]>(`/trusts/${active.trustId}/audit-log`),
  })

  if (isError) {
    return (
      <AppLayout>
        <PageHeader title="Audit Log" subtitle="Every important action, recorded" />
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-stone-500">Could not load the audit log.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader title="Audit Log" subtitle="Every important action, recorded" />
      <Card>
        {isLoading || !data ? <Spinner /> : data.length === 0 ? (
          <EmptyState icon={<FileClock className="h-6 w-6" />} title="No audit entries yet" />
        ) : (
          <div className="divide-y divide-stone-100">
            {data.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500"><FileClock className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color="saffron">{log.action.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs text-stone-400">{timeAgo(log.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-stone-600">
                    <span className="font-medium">{log.actor?.name ?? 'System'}</span> · {log.entityType} {log.entityId ? `(${log.entityId.slice(0, 8)})` : ''}
                  </p>
                  {log.metadata && <pre className="mt-1 max-h-20 overflow-auto rounded-lg bg-stone-50 p-2 text-[10px] text-stone-400">{JSON.stringify(log.metadata, null, 2)}</pre>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppLayout>
  )
}