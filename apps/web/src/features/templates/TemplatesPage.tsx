import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, PlusCircle, Trash2, CheckCircle2, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, Badge, Spinner, EmptyState, PageHeader, Button } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'

export default function TemplatesPage() {
  const active = useActiveTrust()!
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['templates', active.trustId],
    queryFn: () => api.get<any[]>(`/trusts/${active.trustId}/templates`),
  })

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/trusts/${active.trustId}/templates/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates', active.trustId] })
      toast.success('Template activated')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/trusts/${active.trustId}/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates', active.trustId] })
      toast.success('Template deleted')
    },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <AppLayout>
      <PageHeader title="Pāvati Templates" subtitle="Design and manage your receipt layouts" action={<Link to="/app/templates/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> New template</Link>} />
      {isLoading || !data ? <Spinner /> : data.length === 0 ? (
        <Card><EmptyState icon={<FileText className="h-6 w-6" />} title="No templates yet" description="Create a template to design your Pāvati receipts." action={<Link to="/app/templates/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> New template</Link>} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="flex h-44 items-center justify-center bg-gradient-to-br from-saffron-50 to-cream-100 p-4">
                <div className="h-full max-h-40 w-full overflow-hidden rounded-lg shadow-sm" style={{ backgroundImage: t.backgroundImageUrl ? `url(${t.backgroundImageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                  <div className="flex h-full flex-col items-center justify-center gap-1 bg-black/10 p-2 text-center">
                    <span className="rounded bg-white/70 px-2 py-0.5 text-[10px] font-bold text-maroon-700">{t.name}</span>
                    <span className="text-[9px] text-white drop-shadow">Receipt No · Date · Amount</span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-stone-900">{t.name}</p>
                  {t.active ? <Badge color="green"><CheckCircle2 className="h-3 w-3" /> Active</Badge> : <Badge>Inactive</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-stone-400">{t.pageSize}{t.pageSize === 'CUSTOM' ? ` (${t.widthMm}×${t.heightMm}mm)` : ''} · {t.fieldConfigs?.length ?? 0} fields</p>
                <div className="mt-3 flex items-center gap-2">
                  <Link to={`/app/templates/${t.id}/edit`} className="btn-outline flex-1 py-2 text-xs"><Palette className="h-3.5 w-3.5" /> Edit</Link>
                  {!t.active && <Button size="sm" variant="outline" onClick={() => activate.mutate(t.id)}>Activate</Button>}
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm('Delete this template?') && del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  )
}