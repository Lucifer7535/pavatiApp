import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BellRing, MessageSquare, Mail, Send } from 'lucide-react'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, CardHeader, Spinner, Badge, PageHeader, Pagination, Button } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { timeAgo } from '../../lib/utils'

const channelIcon = { SMS: MessageSquare, WHATSAPP: Send, EMAIL: Mail }
const channelColor: Record<string, string> = { SMS: 'blue', WHATSAPP: 'green', EMAIL: 'purple' }
const statusColor: Record<string, string> = { PENDING: 'gold', SENT: 'blue', DELIVERED: 'green', FAILED: 'red' }

export default function NotificationsPage() {
  const active = useActiveTrust()!
  const [page, setPage] = useState(1)
  const [settings, setSettings] = useState<{ notificationSms: boolean; notificationWhatsapp: boolean; notificationEmail: boolean } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', active.trustId, page],
    queryFn: async () => {
      const [list, s] = await Promise.all([
        api.get<{ total: number; page: number; pageSize: number; items: any[] }>(`/trusts/${active.trustId}/notifications`, { page, pageSize: 30 }),
        api.get<{ notificationSms: boolean; notificationWhatsapp: boolean; notificationEmail: boolean }>(`/trusts/${active.trustId}/notifications/settings`),
      ])
      setSettings(s)
      return list
    },
  })

  const saveSettings = useMutation({
    mutationFn: () => api.patch(`/trusts/${active.trustId}/notifications/settings`, { sms: settings!.notificationSms, whatsapp: settings!.notificationWhatsapp, email: settings!.notificationEmail }),
    onSuccess: () => { toast.success('Notification settings saved') },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <AppLayout>
      <PageHeader title="Notifications" subtitle="Outbox and channel preferences" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Outbox" />
          {isLoading || !data ? <Spinner /> : data.items.length === 0 ? (
            <p className="p-8 text-center text-sm text-stone-400">No notifications sent yet. Receipt notifications appear here.</p>
          ) : (
            <>
              <div className="divide-y divide-stone-100">
                {data.items.map((n) => {
                  const Icon = channelIcon[n.channel as keyof typeof channelIcon] ?? BellRing
                  return (
                    <div key={n.id} className="flex items-start gap-3 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge color={channelColor[n.channel] ?? 'default'}>{n.channel}</Badge>
                          <Badge color={statusColor[n.status] ?? 'default'}>{n.status}</Badge>
                          <span className="text-xs text-stone-400">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-stone-600">{n.recipient} · {n.template ?? 'receipt notification'}</p>
                        <p className="truncate text-xs text-stone-400">{n.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="px-4 py-3"><Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} /></div>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Channels" subtitle="Auto-send receipt notifications to donors" />
          <div className="space-y-4 p-6">
            {!settings ? <Spinner /> : (
              <>
                {([
                  ['notificationSms', 'SMS', 'Text message with receipt link'],
                  ['notificationWhatsapp', 'WhatsApp', 'WhatsApp message to donor'],
                  ['notificationEmail', 'Email', 'Email with PDF receipt attached'],
                ] as const).map(([key, label, desc]) => (
                  <label key={key} className="flex items-start gap-3 rounded-xl border border-stone-100 p-3">
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-saffron-600 focus:ring-saffron-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{label}</p>
                      <p className="text-xs text-stone-400">{desc}</p>
                    </div>
                  </label>
                ))}
                <Button className="w-full" onClick={() => saveSettings.mutate()} loading={saveSettings.isPending}>Save settings</Button>
                <p className="text-center text-xs text-stone-400">Mock mode: messages are logged to the API console.</p>
              </>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}

void BellRing