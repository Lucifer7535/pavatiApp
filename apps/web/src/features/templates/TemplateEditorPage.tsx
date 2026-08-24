import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Save, Eye, EyeOff, Upload } from 'lucide-react'
import { DEFAULT_FIELDS, FIELD_KEYS, FIELD_LABELS, buildFieldValues, pagePx } from '@pavati/receipt-engine'
import { PAGE_SIZE_MM, type PageSize, type ReceiptFieldConfig } from '@pavati/shared'
import { api, uploadFile } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, CardHeader, Input, Select } from '../../components/ui'
import { ReceiptCanvasPreview } from '../../components/ReceiptPreview'
import TemplateFieldOverlay from '../../components/TemplateFieldOverlay'
import { useActiveTrust } from '../../lib/stores/auth'
import { fileToDataUrl } from '../../lib/utils'

const ZOOMS: Array<number | 'fit'> = ['fit', 0.75, 1, 1.4, 2]

const PX_PER_MM = 96 / 25.4

function imageDims(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not read image dimensions'))
    img.src = src
  })
}

const SAMPLE: any = {
  trustName: 'Shree Ganesh Mitra Mandal',
  trustAddress: 'Ganesh Mandir Road, Kothrud, Pune, 411038',
  receiptNumber: 'RC-2026-000001',
  receiptDate: new Date().toISOString(),
  donorName: 'Rajesh Patil',
  donorPhone: '9876543210',
  amount: 501,
  category: 'Ganpati Donation',
  paymentMode: 'CASH',
  collectorName: 'Sanjay Kulkarni',
}

export default function TemplateEditorPage() {
  const { templateId } = useParams()
  const isNew = templateId === 'new' || !templateId
  const navigate = useNavigate()
  const active = useActiveTrust()!
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [pageSize, setPageSize] = useState<PageSize>('CUSTOM')
  const [widthMm, setWidthMm] = useState(148)
  const [heightMm, setHeightMm] = useState(83)
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [fields, setFields] = useState<ReceiptFieldConfig[]>([])

  useEffect(() => {
    if (isNew) return
    api.get<any>(`/trusts/${active.trustId}/templates/${templateId}`).then((t) => {
      setName(t.name)
      setPageSize(t.pageSize)
      setWidthMm(t.widthMm ?? 148)
      setHeightMm(t.heightMm ?? 83)
      setBgUrl(t.backgroundImageUrl)
      if (t.fieldConfigs?.length) setFields(t.fieldConfigs)
    }).finally(() => setLoading(false))
  }, [templateId, active.trustId])

  const template = useMemo(() => ({
    id: templateId ?? 'preview',
    name,
    pageSize,
    widthMm,
    heightMm,
    backgroundImageUrl: bgUrl,
    fieldConfigs: fields,
  }), [name, pageSize, widthMm, heightMm, bgUrl, fields])

  const updateField = (i: number, patch: Partial<ReceiptFieldConfig>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  const addField = (key: (typeof FIELD_KEYS)[number]) => {
    const def = DEFAULT_FIELDS.find((d) => d.key === key)
    setFields([...fields, def ? { ...def } : { key, label: FIELD_LABELS[key], x: 4, y: 90, width: 40, height: 7, fontSize: 14, fontFamily: 'Mukta', color: '#4a1f0c', align: 'left', bold: false, visible: true }])
    setSelected(fields.length)
  }

  const onBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      const { width, height } = await imageDims(dataUrl)
      const wMm = Math.round((width / PX_PER_MM) * 10) / 10
      const hMm = Math.round((height / PX_PER_MM) * 10) / 10
      const res = await uploadFile(dataUrl)
      setBgUrl(res.url)
      setPageSize('CUSTOM')
      setWidthMm(wMm)
      setHeightMm(hMm)
      toast.success(`Background uploaded — page set to ${wMm} × ${hMm} mm`)
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed')
    }
  }

  const save = async () => {
    if (!name.trim()) return toast.error('Template needs a name')
    setSaving(true)
    const body = { name, pageSize, widthMm: pageSize === 'CUSTOM' ? widthMm : null, heightMm: pageSize === 'CUSTOM' ? heightMm : null, backgroundImageUrl: bgUrl, fieldConfigs: fields }
    try {
      if (isNew) {
        await api.post(`/trusts/${active.trustId}/templates`, body)
        toast.success('Template created')
      } else {
        await api.patch(`/trusts/${active.trustId}/templates/${templateId}`, body)
        toast.success('Template saved')
      }
      navigate('/app/templates')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const [selected, setSelected] = useState<number | null>(null)
  const sel = selected !== null ? fields[selected] : null
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [editZoom, setEditZoom] = useState<number | 'fit'>('fit')
  const page = pagePx(pageSize, widthMm, heightMm)
  const aspect = page.width / page.height
  const sampleValues = useMemo(() => buildFieldValues(SAMPLE as any), [])

  return (
    <AppLayout>
      {loading ? <div className="py-10 text-center text-stone-400">Loading…</div> : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link to="/app/templates" className="mb-1 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700"><ArrowLeft className="h-4 w-4" /> Back to templates</Link>
              <h1 className="text-2xl font-bold text-stone-900">{isNew ? 'New template' : `Edit: ${name}`}</h1>
            </div>
            <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> Save template</Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <Card>
                <CardHeader title="Template settings" />
                <div className="space-y-4 p-5">
                  <div><label className="label">Template name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ganeshotsav 2026" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(PAGE_SIZE_MM).map(([key, mm]) => (
                      <button key={key} onClick={() => { setPageSize(key as PageSize); if (key !== 'CUSTOM') { setWidthMm(mm.width); setHeightMm(mm.height) } }}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${pageSize === key ? 'border-saffron-500 bg-saffron-50 text-saffron-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}>
                        {key === 'CUSTOM' ? `Custom\n(${widthMm}×${heightMm})` : `${key} (${mm.width}×${mm.height}mm)`}
                      </button>
                    ))}
                  </div>
                  {pageSize === 'CUSTOM' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="label">Width (mm)</label><Input type="number" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value))} /></div>
                      <div><label className="label">Height (mm)</label><Input type="number" value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value))} /></div>
                    </div>
                  )}
                  <div>
                    <label className="label">Background image</label>
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-24 overflow-hidden rounded-lg border border-stone-200" style={{ backgroundImage: bgUrl ? `url(${bgUrl})` : undefined, backgroundSize: 'cover' }} />
                      <label className="cursor-pointer"><span className="btn-outline"><Upload className="h-4 w-4" /> Upload</span><input type="file" accept="image/*" className="hidden" onChange={onBg} /></label>
                      {bgUrl && <button onClick={() => setBgUrl(null)} className="text-xs text-red-600 hover:underline">Remove</button>}
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Fields" action={
                  <Select value="" onChange={(e) => { if (e.target.value) { addField(e.target.value as (typeof FIELD_KEYS)[number]); e.target.value = '' } }} className="w-44">
                    <option value="">＋ Add field…</option>
                    {FIELD_KEYS.map((k) => <option key={k} value={k}>{FIELD_LABELS[k]}</option>)}
                  </Select>
                } />
                <div className="max-h-80 space-y-1 overflow-y-auto p-3">
                  {fields.map((f, i) => (
                    <button key={`${f.key}-${i}`} onClick={() => setSelected(selected === i ? null : i)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${selected === i ? 'bg-saffron-50 text-saffron-700' : 'text-stone-700 hover:bg-stone-50'}`}>
                      <span className="font-medium">{f.label}</span>
                      <span className="flex items-center gap-2 text-xs text-stone-400">
                        {f.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {Math.round(f.x)}%, {Math.round(f.y)}%
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-500">Visual editor</p>
                  <div className="w-24 shrink-0">
                    <Select value={editZoom === 'fit' ? 'fit' : String(editZoom)} onChange={(e) => setEditZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}>
                      {ZOOMS.map((z) => <option key={String(z)} value={String(z)}>{z === 'fit' ? 'Fit' : `${z}×`}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-stone-100 bg-stone-50 p-3">
                  {fields.length === 0 ? (
                    <div className="flex min-h-44 items-center justify-center px-6 text-center text-xs text-stone-400">No fields yet — add them from the Fields panel</div>
                  ) : (
                    <div style={editZoom === 'fit' ? undefined : { width: `${editZoom * 100}%` }}>
                      <TemplateFieldOverlay
                        fields={fields}
                        aspect={aspect}
                        bgUrl={bgUrl}
                        values={sampleValues}
                        selected={selected}
                        onSelect={setSelected}
                        onUpdate={updateField}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-500">Live preview</p>
                  <div className="w-24 shrink-0">
                    <Select value={zoom === 'fit' ? 'fit' : String(zoom)} onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}>
                      {ZOOMS.map((z) => <option key={String(z)} value={String(z)}>{z === 'fit' ? 'Fit' : `${z}×`}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="max-h-[70vh] overflow-auto rounded-lg border border-stone-100 bg-stone-50 p-3">
                  <div style={zoom === 'fit' ? undefined : { width: `${zoom * 100}%` }}>
                    <ReceiptCanvasPreview template={template} data={SAMPLE} scale={zoom === 'fit' ? 1.4 : Math.max(1.4, zoom)} fit={zoom === 'fit'} className="rounded-lg shadow" />
                  </div>
                </div>
              </div>

              {sel && (
                <Card>
                  <CardHeader title={`Edit: ${sel.label}`} action={<Button size="sm" variant="ghost" onClick={() => updateField(selected!, { visible: !sel.visible })}>{sel.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>} />
                  <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
                    <div><label className="label">X %</label><Input type="number" min={0} max={100} value={sel.x} onChange={(e) => updateField(selected!, { x: Number(e.target.value) })} /></div>
                    <div><label className="label">Y %</label><Input type="number" min={0} max={100} value={sel.y} onChange={(e) => updateField(selected!, { y: Number(e.target.value) })} /></div>
                    <div><label className="label">Width %</label><Input type="number" min={1} max={100} value={sel.width} onChange={(e) => updateField(selected!, { width: Number(e.target.value) })} /></div>
                    <div><label className="label">Height %</label><Input type="number" min={1} max={100} value={sel.height} onChange={(e) => updateField(selected!, { height: Number(e.target.value) })} /></div>
                    <div><label className="label">Font size</label><Input type="number" min={0} max={200} value={sel.fontSize} onChange={(e) => updateField(selected!, { fontSize: Number(e.target.value) })} disabled={sel.key === 'logo' || sel.key === 'qrCode'} /></div>
                    <div><label className="label">Align</label>
                      <Select value={sel.align} onChange={(e) => updateField(selected!, { align: e.target.value as any })}>
                        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                      </Select>
                    </div>
                    <div><label className="label">Weight</label>
                      <Select value={sel.fontFamily} onChange={(e) => updateField(selected!, { fontFamily: e.target.value })}>
                        <option value="Mukta">Regular</option><option value="Mukta-Medium">Medium</option>
                        <option value="Mukta-SemiBold">SemiBold</option><option value="Mukta-Bold">Bold</option>
                      </Select>
                    </div>
                    <div><label className="label">Color</label><input type="color" value={sel.color} onChange={(e) => updateField(selected!, { color: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-stone-300" /></div>
                    <div><label className="label">Prefix</label><Input value={sel.prefix ?? ''} onChange={(e) => updateField(selected!, { prefix: e.target.value })} placeholder="e.g. Date: " /></div>
                    {selected !== null && (
                      <div className="col-span-2 flex items-end">
                        <Button size="sm" variant="danger" onClick={() => setFields((prev) => prev.filter((_, i) => i !== selected))}>Remove field</Button>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}