import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import { FolderEmptyIcon, SpinnerIcon } from '../components/Icons'

const VITAL_TYPES = [
  { value: 'blood_pressure', label: 'Blood Pressure' },
  { value: 'blood_sugar', label: 'Blood Sugar' },
  { value: 'weight', label: 'Weight' },
]

export default function FamilyProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewerDoc, setViewerDoc] = useState(null)

  useEffect(() => { refresh() }, [id])

  async function refresh() {
    setLoading(true)
    try {
      const result = await api.get(`/api/family-members/${id}/timeline`)
      setData(result)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteDocument(docId) {
    if (!window.confirm('Are you sure you want to delete this document?')) return
    try {
      await api.delete(`/api/documents/${docId}`)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16 animate-fade-in">
        <SpinnerIcon className="w-8 h-8 text-blue-700" />
      </div>
    )
  }

  const { member, items, current_medications } = data || {}

  if (error && !data) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
        >
          &larr; Back to dashboard
        </button>
        <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm border border-red-100">{error}</div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate('/')}
        className="text-sm text-blue-700 hover:text-blue-900 mb-5 inline-flex items-center gap-1 font-medium"
      >
        &larr; Back to dashboard
      </button>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 mb-5 text-sm border border-red-100">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-blue-100 shadow-md p-6 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-200 shrink-0">
              {initials(member?.name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{member?.name}</h1>
              {member?.age != null && (
                <p className="text-sm text-gray-500 mt-0.5">Age {member.age}</p>
              )}
            </div>
          </div>
          <RemoveMemberButton memberId={id} onRemoved={() => navigate('/')} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {member?.chronic_conditions?.map((c, i) => (
            <span key={i} className="text-xs bg-blue-100 text-blue-700 rounded-full px-3 py-1 font-semibold">{c}</span>
          ))}
          {member?.allergies?.map((a, i) => (
            <span key={i} className="text-xs bg-amber-100 text-amber-700 rounded-full px-3 py-1 font-semibold">{a}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <UploadForm memberId={id} onUploaded={refresh} />
        <VitalForm memberId={id} onCreated={refresh} />
      </div>

      {current_medications?.length > 0 && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Current Medications</h2>
          <div className="flex flex-wrap gap-2">
            {current_medications.map((drug, i) => (
              <span key={i} className="text-xs bg-purple-100 text-purple-800 rounded-full px-3 py-1 font-semibold border border-purple-200">
                {drug}
              </span>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold text-gray-900 mb-4">Timeline</h2>
      {!items?.length ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-blue-100 shadow-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 text-blue-300 mb-4">
            <FolderEmptyIcon className="w-7 h-7" />
          </div>
          <p className="text-base font-semibold text-gray-900 mb-1">No documents or vitals recorded yet</p>
          <p className="text-sm text-gray-500">Upload a document or log a vital to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <TimelineItem
              key={`${item.kind}-${item.id}`}
              item={item}
              onDeleteDocument={item.kind === 'document' ? () => handleDeleteDocument(item.id) : undefined}
              onVitalChanged={item.kind === 'vital' ? refresh : undefined}
              onViewImage={item.kind === 'document' ? () => setViewerDoc(item) : undefined}
            />
          ))}
        </div>
      )}

      {viewerDoc?.file_url && (
        <ImageViewerModal
          src={viewerDoc.file_url}
          fileName={viewerDoc.file_name}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </div>
  )
}

function UploadForm({ memberId, onUploaded }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('family_member_id', memberId)
      await api.upload('/api/documents/upload', formData)
      setSuccess('Document uploaded')
      setFile(null)
      e.target.reset()
      onUploaded()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-blue-100 shadow-md p-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Upload Document</h3>
      <div className="relative">
        <input
          type="file"
          onChange={e => setFile(e.target.files[0])}
          disabled={uploading}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 file:cursor-pointer file:min-h-11 disabled:opacity-50"
        />
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
            <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
              <SpinnerIcon className="w-5 h-5" />
              Extracting with AI…
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {success && <p className="text-xs text-green-700 mt-2">{success}</p>}
      <button
        type="submit"
        disabled={!file || uploading}
        className="mt-4 bg-blue-700 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 min-h-11 shadow-md shadow-blue-200 hover:shadow-lg transition-all w-full sm:w-auto"
      >
        {uploading ? (
          <span className="inline-flex items-center gap-2">
            <SpinnerIcon className="w-4 h-4" /> Uploading…
          </span>
        ) : 'Upload'}
      </button>
    </form>
  )
}

function VitalForm({ memberId, onCreated }) {
  const [type, setType] = useState('blood_pressure')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.post('/api/vitals', { family_member_id: memberId, type, value, date })
      setSuccess('Vital recorded')
      setValue('')
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-blue-100 shadow-md p-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Log Vital</h3>
      <div className="space-y-3">
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        >
          {VITAL_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          required
          placeholder={type === 'blood_pressure' ? '120/80' : type === 'weight' ? '70 kg' : '100 mg/dL'}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {success && <p className="text-xs text-green-700 mt-2">{success}</p>}
      <button
        type="submit"
        disabled={saving || !value}
        className="mt-4 bg-blue-700 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 min-h-11 shadow-md shadow-blue-200 hover:shadow-lg transition-all w-full sm:w-auto"
      >
        {saving ? (
          <span className="inline-flex items-center gap-2">
            <SpinnerIcon className="w-4 h-4" /> Saving…
          </span>
        ) : 'Log Vital'}
      </button>
    </form>
  )
}

function TimelineItem({ item, onDeleteDocument, onVitalChanged, onViewImage }) {
  const date = new Date(item.occurred_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  if (item.kind === 'document') {
    const summary = item.extracted_summary
    const isImage = /\.(jpe?g|png)$/i.test(item.file_name || '')
    return (
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{item.file_name}</p>
            <p className="text-xs text-gray-500">{date}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.file_url && (isImage && onViewImage ? (
              <button
                onClick={() => onViewImage(item)}
                className="text-sm text-blue-700 hover:text-blue-900 font-semibold"
              >
                View
              </button>
            ) : (
              <a
                href={item.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:text-blue-900 font-semibold"
              >
                View
              </a>
            ))}
            {item.file_url && (
              <DownloadLink url={item.file_url} fileName={item.file_name} />
            )}
            {onDeleteDocument && (
              <button
                onClick={onDeleteDocument}
                className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 font-medium px-2 py-1 rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          {summary ? (
            <div className="space-y-1.5">
              {summary.document_type && (
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">{summary.document_type}</p>
              )}
              {summary.date && (
                <p className="text-xs text-gray-500">Date: {summary.date}</p>
              )}
              {Array.isArray(summary.key_findings) && summary.key_findings.length > 0 && (
                <ul className="text-xs text-gray-700 list-disc list-inside space-y-0.5">
                  {summary.key_findings.map((finding, i) => (
                    <li key={i}>{finding}</li>
                  ))}
                </ul>
              )}
              {Array.isArray(summary.mentioned_drug_names) && summary.mentioned_drug_names.length > 0 && (
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Drugs:</span> {summary.mentioned_drug_names.join(', ')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Summary unavailable</p>
          )}
        </div>
      </div>
    )
  }

  return <VitalTimelineItem item={item} onChanged={onVitalChanged} />
}

function VitalTimelineItem({ item, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.value)
  const [date, setDate] = useState(item.occurred_at.slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const typeLabels = { blood_pressure: 'Blood Pressure', blood_sugar: 'Blood Sugar', weight: 'Weight' }
  const label = typeLabels[item.type] || item.type
  const displayDate = new Date(item.occurred_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
  const placeholder = item.type === 'blood_pressure'
    ? '120/80'
    : item.type === 'weight' ? '70 kg' : '100 mg/dL'

  function startEdit() {
    setValue(item.value)
    setDate(item.occurred_at.slice(0, 10))
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError('')
  }

  async function handleSave() {
    setBusy(true)
    setError('')
    try {
      await api.patch(`/api/vitals/${item.id}`, { value, date })
      setEditing(false)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      await api.delete(`/api/vitals/${item.id}`)
      onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-green-700 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{label}</p>
            {item.source === 'document' && (
              <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md border border-blue-100">
                From document
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={busy || !value.trim() || !date}
              className="bg-blue-700 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 min-h-11 shadow-md shadow-blue-200 hover:shadow-lg transition-all"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <SpinnerIcon className="w-4 h-4" /> Saving…
                </span>
              ) : 'Save'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={busy}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 min-h-11 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center text-green-700 shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          {label}: <span className="font-normal">{item.value}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p className="text-xs text-gray-500">{displayDate}</p>
          {item.source === 'document' && (
            <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md border border-blue-100">
              From document
            </span>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
      {onChanged && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={startEdit}
            disabled={busy}
            className="text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50 font-medium px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 font-medium px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  )
}

function DownloadLink({ url, fileName }) {
  const [downloading, setDownloading] = useState(false)

  async function handleClick() {
    if (downloading) return
    setDownloading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = fileName || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(url, '_blank', 'noopener')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={downloading}
      className="text-sm text-blue-700 hover:text-blue-900 font-semibold disabled:opacity-50"
    >
      {downloading ? 'Downloading…' : 'Download'}
    </button>
  )
}

function ImageViewerModal({ src, fileName, onClose }) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const containerRef = useRef(null)
  const pointersRef = useRef(new Map())
  const lastPinchRef = useRef(null)
  const downPosRef = useRef(null)
  const movedRef = useRef(false)
  const startedOnBackdropRef = useRef(false)

  const MIN_SCALE = 0.25
  const MAX_SCALE = 10

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      zoomToward(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function zoomToward(clientX, clientY, factor) {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ux = clientX - (rect.left + rect.width / 2)
    const uy = clientY - (rect.top + rect.height / 2)
    setTransform(t => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor))
      const applied = scale / t.scale
      return {
        scale,
        x: ux - (ux - t.x) * applied,
        y: uy - (uy - t.y) * applied,
      }
    })
  }

  function pinchInfo() {
    const pts = [...pointersRef.current.values()]
    const [a, b] = pts
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  function handlePointerDown(e) {
    e.preventDefault()
    containerRef.current.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    startedOnBackdropRef.current = e.target === containerRef.current
    downPosRef.current = { x: e.clientX, y: e.clientY }
    movedRef.current = false
    if (pointersRef.current.size === 1) setDragging(true)
    if (pointersRef.current.size === 2) lastPinchRef.current = pinchInfo()
  }

  function handlePointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return
    const prev = pointersRef.current.get(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (downPosRef.current &&
        Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y) > 6) {
      movedRef.current = true
    }

    if (pointersRef.current.size === 1) {
      setTransform(t => ({ ...t, x: t.x + (e.clientX - prev.x), y: t.y + (e.clientY - prev.y) }))
    } else if (pointersRef.current.size === 2) {
      const pinch = pinchInfo()
      const last = lastPinchRef.current
      if (last && last.dist > 0 && pinch.dist > 0) {
        zoomToward(pinch.mid.x, pinch.mid.y, pinch.dist / last.dist)
        setTransform(t => ({
          ...t,
          x: t.x + (pinch.mid.x - last.mid.x),
          y: t.y + (pinch.mid.y - last.mid.y),
        }))
      }
      lastPinchRef.current = pinch
    }
  }

  function handlePointerUp(e) {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) lastPinchRef.current = null
    if (pointersRef.current.size === 0) {
      setDragging(false)
      if (!movedRef.current && startedOnBackdropRef.current) onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <p className="text-sm font-medium text-white/80 truncate">{fileName}</p>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 rounded-xl px-4 py-2 min-h-11 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`flex-1 overflow-hidden flex items-center justify-center touch-none select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {loadError ? (
          <div className="text-center px-6">
            <p className="text-sm font-semibold text-white mb-1">Couldn't load image</p>
            <p className="text-xs text-white/50">The link may have expired — reload the page and try again.</p>
          </div>
        ) : (
          <img
            src={src}
            alt={fileName}
            draggable={false}
            onError={() => setLoadError(true)}
            className="max-w-[92%] max-h-[92%] object-contain will-change-transform"
            style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
          />
        )}
      </div>
      <p className="text-center text-xs text-white/50 py-3 shrink-0">
        Scroll or pinch to zoom · Drag to pan · Esc to close
      </p>
    </div>
  )
}

function RemoveMemberButton({ memberId, onRemoved }) {
  const [deleting, setDeleting] = useState(false)

  async function handleRemove() {
    const message = 'Are you sure you want to remove this family member? This will also delete all their documents and vitals.'
    if (!window.confirm(message)) return
    setDeleting(true)
    try {
      await api.delete(`/api/family-members/${memberId}`)
      onRemoved()
    } catch (err) {
      alert(err.message || 'Failed to remove family member')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={deleting}
      className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 font-medium px-3 py-2 rounded-lg transition-colors border border-transparent hover:border-red-100 disabled:opacity-50"
    >
      {deleting ? 'Removing…' : 'Remove'}
    </button>
  )
}
