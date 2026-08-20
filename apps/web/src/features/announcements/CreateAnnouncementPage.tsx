import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, ImagePlus, Megaphone } from 'lucide-react'
import { api, uploadFile } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, CardHeader, Input, Select, Textarea } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { fileToDataUrl } from '../../lib/utils'

const schema = z.object({
  title: z.string().min(2, 'Title is required'),
  content: z.string().min(2, 'Content is required'),
  type: z.enum(['GENERAL', 'FESTIVAL', 'MEETING', 'CAMPAIGN', 'EVENT', 'NOTICE']),
  pinned: z.boolean().default(false),
})
type Form = z.infer<typeof schema>

export default function CreateAnnouncementPage() {
  const navigate = useNavigate()
  const active = useActiveTrust()!
  const [loading, setLoading] = useState(false)
  const [media, setMedia] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any, defaultValues: { type: 'FESTIVAL', pinned: false } })

  const onMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    const res = await uploadFile(dataUrl)
    setMedia(res.url)
    toast.success('Media uploaded')
  }

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      await api.post(`/trusts/${active.trustId}/announcements`, { ...data, mediaUrl: media })
      toast.success('Announcement published!')
      navigate('/app/announcements')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <Link to="/app/announcements" className="mb-4 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-stone-900">New announcement</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <div className="space-y-4 p-6">
            <div>
              <label className="label">Title *</label>
              <Input placeholder="e.g. Ganeshotsav 2026 begins Monday" {...register('title')} autoFocus />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>
            <div>
              <label className="label">Content *</label>
              <Textarea placeholder="Write the announcement…" rows={6} {...register('content')} />
              {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content.message}</p>}
            </div>
            <div>
              <label className="label">Media <span className="text-stone-400">(optional)</span></label>
              <div className="flex items-center gap-3">
                {media && <img src={media} alt="" className="h-16 w-24 rounded-lg border border-stone-200 object-cover" />}
                <label className="cursor-pointer"><span className="btn-outline"><ImagePlus className="h-4 w-4" /> Attach image</span><input type="file" accept="image/*" className="hidden" onChange={onMedia} /></label>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Publishing" />
          <div className="space-y-4 p-6">
            <div>
              <label className="label">Type</label>
              <Select {...register('type')}>
                <option value="FESTIVAL">Festival</option>
                <option value="GENERAL">General</option>
                <option value="MEETING">Meeting</option>
                <option value="CAMPAIGN">Campaign</option>
                <option value="EVENT">Event</option>
                <option value="NOTICE">Notice</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" {...register('pinned')} className="h-4 w-4 rounded border-stone-300 text-saffron-600 focus:ring-saffron-500" />
              Pin to top
            </label>
            <Button type="submit" className="w-full" loading={loading}><Megaphone className="h-4 w-4" /> Publish</Button>
          </div>
        </Card>
      </form>
    </AppLayout>
  )
}