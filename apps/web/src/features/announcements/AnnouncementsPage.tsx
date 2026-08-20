import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Megaphone, Pin, Trash2, PlusCircle, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, Badge, Spinner, EmptyState, PageHeader, Pagination, Button } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { timeAgo } from '../../lib/utils'

const typeColor: Record<string, string> = { GENERAL: 'default', FESTIVAL: 'saffron', MEETING: 'blue', CAMPAIGN: 'purple', EVENT: 'green', NOTICE: 'gold' }

export default function AnnouncementsPage() {
  const active = useActiveTrust()!
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', active.trustId, page],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: any[] }>(`/trusts/${active.trustId}/announcements`, { page, pageSize: 20 }),
  })

  const pin = useMutation({
    mutationFn: (id: string) => api.post(`/trusts/${active.trustId}/announcements/${id}/pin`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements', active.trustId] }); toast.success('Updated') },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/trusts/${active.trustId}/announcements/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements', active.trustId] }); toast.success('Deleted') },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <AppLayout>
      <PageHeader title="Announcements" subtitle="Keep members and donors informed" action={<Link to="/app/announcements/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> New announcement</Link>} />
      {isLoading || !data ? <Spinner /> : data.items.length === 0 ? (
        <Card><EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements yet" description="Share festive updates with your members." action={<Link to="/app/announcements/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> New announcement</Link>} /></Card>
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((a) => (
              <Card key={a.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600"><BellRing className="h-5 w-5" /></div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {a.pinned && <Pin className="h-3.5 w-3.5 text-maroon-600" />}
                        <h3 className="font-semibold text-stone-900">{a.title}</h3>
                        <Badge color={typeColor[a.type] ?? 'default'}>{a.type}</Badge>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{a.content}</p>
                      <p className="mt-2 text-xs text-stone-400">{a.author?.name} · {timeAgo(a.publishedAt)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => pin.mutate(a.id)} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-maroon-600" title={a.pinned ? 'Unpin' : 'Pin'}><Pin className={`h-4 w-4 ${a.pinned ? 'text-maroon-600' : ''}`} /></button>
                    <button onClick={() => confirm('Delete this announcement?') && del.mutate(a.id)} className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </AppLayout>
  )
}

void Button