import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import {
  AlertOctagonIcon,
  CheckCircleIcon,
  WarningTriangleIcon,
} from '../components/Icons'
import { ErrorState, InlineSpinner, RetryButton } from '../components/StateViews'

const VERDICT_STYLES = {
  SAFE: {
    card: 'bg-green-50 border-green-200 text-green-900',
    badge: 'bg-green-100 text-green-800 border-green-300',
    icon: 'text-green-600',
    Icon: CheckCircleIcon,
  },
  CAUTION: {
    card: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: 'text-yellow-600',
    Icon: WarningTriangleIcon,
  },
  UNSAFE: {
    card: 'bg-red-50 border-red-200 text-red-900',
    badge: 'bg-red-100 text-red-800 border-red-300',
    icon: 'text-red-600',
    Icon: AlertOctagonIcon,
  },
}

const DISCLAIMER = 'This is not medical advice. Consult a physician.'

const SUMMARY_FAIL_SENTINEL = 'Summary generation failed'
const SAFETY_FAIL_SENTINEL = 'Safety check could not be completed'

function isSummaryFailed(summary) {
  if (!summary) return true
  const bullets = summary.short_summary || []
  return bullets.length === 0 || bullets[0] === SUMMARY_FAIL_SENTINEL
}

function isSafetyFailed(safety) {
  if (!safety) return true
  return (safety.reasoning || '').includes(SAFETY_FAIL_SENTINEL)
}

async function fetchWithRetry(fn, maxAttempts = 3, baseDelayMs = 800) {
  let lastErr
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)))
      }
    }
  }
  throw lastErr
}

function SkeletonLines({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 animate-pulse-soft ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded"
          style={{ width: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="space-y-4 animate-pulse-soft">
      <div className="h-5 bg-gray-200 rounded w-32" />
      <SkeletonLines lines={4} />
      <div className="h-4 bg-gray-200 rounded w-40" />
    </div>
  )
}

function SafetySkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 p-5 space-y-3 animate-pulse-soft">
      <div className="h-5 bg-gray-200 rounded w-40" />
      <SkeletonLines lines={3} />
    </div>
  )
}

function SearchSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-md p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2 animate-pulse-soft">
          <div className="h-7 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
        <div className="h-10 bg-gray-200 rounded-full w-24 animate-pulse-soft" />
      </div>
      <div className="border-t border-gray-100 pt-4">
        <SummarySkeleton />
      </div>
      <div className="border-t border-gray-100 pt-4">
        <SafetySkeleton />
      </div>
    </div>
  )
}

export default function MedicineSearch() {
  const [members, setMembers] = useState([])
  const [membersError, setMembersError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [searchedMemberId, setSearchedMemberId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [showLong, setShowLong] = useState(false)
  const [summaryRetrying, setSummaryRetrying] = useState(false)
  const [safetyRetrying, setSafetyRetrying] = useState(false)

  // Keep latest search params so retry buttons can re-run the same search
  const lastSearchRef = useRef({ query: '', selectedMemberId: '' })

  useEffect(() => {
    api.get('/api/family-members')
      .then(setMembers)
      .catch(err => {
        console.error('Failed to load family members:', err)
        setMembersError('Could not load family members. Please refresh.')
      })
  }, [])

  const runSearch = useCallback(async (q, memberId) => {
    const path = memberId
      ? `/api/medicine/search-filtered?query=${encodeURIComponent(q)}&family_member_id=${encodeURIComponent(memberId)}`
      : `/api/medicine/search?query=${encodeURIComponent(q)}`
    return fetchWithRetry(() => api.get(path), 3, 800)
  }, [])

  async function doSearch(q, memberId) {
    lastSearchRef.current = { query: q, selectedMemberId: memberId }
    setSearchedMemberId(memberId)
    setLoading(true)
    setError('')
    setResult(null)
    setShowLong(false)
    try {
      const data = await runSearch(q, memberId)
      setResult(data)
    } catch (err) {
      setError('Safety check unavailable — please try again.')
      console.error('[Medicine Search] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    doSearch(query.trim(), selectedMemberId)
  }

  async function handleRetrySummary() {
    const { query: q, selectedMemberId: mid } = lastSearchRef.current
    setSummaryRetrying(true)
    try {
      const data = await runSearch(q, mid)
      if (data?.status === 'OK') {
        setResult(prev => ({ ...prev, summary: data.summary }))
      }
    } catch {
      // keep existing failed state; user can click Retry again
    } finally {
      setSummaryRetrying(false)
    }
  }

  async function handleRetrySafety() {
    const { query: q, selectedMemberId: mid } = lastSearchRef.current
    setSafetyRetrying(true)
    try {
      const data = await runSearch(q, mid)
      if (data?.status === 'OK') {
        setResult(prev => ({ ...prev, safety: data.safety }))
      }
    } catch {
      // keep existing failed state
    } finally {
      setSafetyRetrying(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl border border-blue-100 shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Medicine Search</h1>
        <p className="text-sm text-gray-500 mb-5">Search medications and get a personalized safety audit.</p>

        {membersError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-4 border border-red-100" role="alert">{membersError}</p>
        )}

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="med-query" className="block text-sm font-medium text-gray-700 mb-1.5">Medication name</label>
              <input
                id="med-query"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. Metformin"
                required
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
            </div>
            <div>
              <label htmlFor="member-select" className="block text-sm font-medium text-gray-700 mb-1.5">Family member</label>
              <select
                id="member-select"
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              >
                <option value="">None — general search</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 min-h-11 w-full sm:w-auto shadow-md shadow-blue-200 hover:shadow-lg transition-all"
          >
            {loading ? <InlineSpinner label="Searching…" /> : selectedMemberId ? 'Search & Check Safety' : 'Search'}
          </button>
        </form>
      </div>

      {loading && (
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Searching medications…</span>
          <SearchSkeleton />
        </div>
      )}

      {error && (
        <ErrorState
          title="Safety check unavailable"
          message={error}
          onRetry={() => doSearch(lastSearchRef.current.query, lastSearchRef.current.selectedMemberId)}
        />
      )}

      {result?.status === 'NOT_FOUND' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center" role="status" aria-live="polite">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-400 mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">No results found for this medication</p>
          <p className="text-sm text-gray-500">Try checking the spelling or searching for the generic name.</p>
        </div>
      )}

      {result?.status === 'OK' && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-md p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{result.drug?.genericName || query}</h2>
              {result.drug?.brandName && result.drug.brandName !== result.drug?.genericName && (
                <p className="text-sm text-gray-500 mt-1">Brand: {result.drug.brandName}</p>
              )}
              <span className="inline-flex mt-3 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Data sources: openFDA, RxNorm, Google Gemini
              </span>
            </div>
            {result.safety?.verdict && VERDICT_STYLES[result.safety.verdict] && (
              <VerdictBadge verdict={result.safety.verdict} />
            )}
          </div>

          {/* Summary section */}
          <div className="border-t border-gray-100 pt-4">
            {summaryRetrying ? (
              <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
                <InlineSpinner label="Loading summary…" className="text-sm text-blue-700 font-medium" />
                <SummarySkeleton />
              </div>
            ) : isSummaryFailed(result.summary) ? (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Short Summary</h3>
                <p className="text-sm text-gray-500">Summary could not be loaded.</p>
                <RetryButton onClick={handleRetrySummary} label="Retry summary" />
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Short Summary</h3>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                  {(result.summary?.short_summary || []).map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowLong(!showLong)}
                  className="text-sm text-blue-700 hover:text-blue-900 font-semibold"
                >
                  {showLong ? 'Hide detailed summary' : 'Show detailed summary'}
                </button>
                {showLong && (
                  <div className="text-sm text-gray-700 leading-relaxed pt-1">
                    {result.summary?.long_summary || 'Detailed summary unavailable.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Safety section — only shown when a family member was selected */}
          {(result.safety || searchedMemberId) && (
            <div className="border-t border-gray-100 pt-4">
              {safetyRetrying ? (
                <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
                  <InlineSpinner label="Loading safety assessment…" className="text-sm text-blue-700 font-medium" />
                  <SafetySkeleton />
                </div>
              ) : isSafetyFailed(result.safety) ? (
                <div className="rounded-2xl border border-gray-200 p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide">Safety Assessment</h3>
                  <p className="text-sm text-gray-500">Safety assessment could not be completed.</p>
                  <RetryButton onClick={handleRetrySafety} label="Retry safety check" />
                </div>
              ) : result.safety ? (
                <SafetyCard safety={result.safety} />
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VerdictBadge({ verdict }) {
  const style = VERDICT_STYLES[verdict]
  const Icon = style.Icon
  return (
    <span className={`inline-flex items-center gap-2 self-start rounded-full border-2 px-4 py-2 text-sm font-extrabold uppercase tracking-wide ${style.badge}`}>
      <Icon className={`w-5 h-5 ${style.icon}`} />
      {verdict}
    </span>
  )
}

function SafetyCard({ safety }) {
  const style = VERDICT_STYLES[safety.verdict] || VERDICT_STYLES.CAUTION
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${style.card}`}>
      <h3 className="text-sm font-extrabold uppercase tracking-wide">Safety Assessment</h3>
      {safety.interaction_flagged && (
        <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-3 py-1 text-xs font-bold">
          <WarningTriangleIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          Interaction Risk
        </div>
      )}
      <p className="text-sm leading-relaxed">{safety.reasoning}</p>
      <p className="text-xs font-bold opacity-80">{DISCLAIMER}</p>
    </div>
  )
}
