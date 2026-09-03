import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import { EmptyStateIcon, SpinnerIcon } from '../components/Icons'

export default function Dashboard() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    try {
      const data = await api.get('/api/family-members')
      setMembers(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Family Members</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-blue-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all min-h-11 w-full sm:w-auto shadow-md shadow-blue-200"
        >
          {showForm ? 'Cancel' : '+ Add Family Member'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 mb-6 text-sm border border-red-100">{error}</div>
      )}

      {showForm && (
        <AddFamilyMemberForm
          onCreated={(member) => {
            setMembers([member, ...members])
            setShowForm(false)
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <SpinnerIcon className="w-8 h-8 text-blue-700" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-blue-100 shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-300 mb-4">
            <EmptyStateIcon className="w-8 h-8" />
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-1">No family members yet</p>
          <p className="text-sm text-gray-500">Add your first family member to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {members.map(m => (
            <Link
              key={m.id}
              to={`/family/${m.id}`}
              className="group bg-white rounded-2xl border border-blue-100 p-5 hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-blue-200 shrink-0">
                  {initials(m.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{m.name}</h2>
                  {m.age != null && (
                    <p className="text-sm text-gray-500 mt-0.5">Age {m.age}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {m.chronic_conditions?.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2.5 py-1 font-medium">
                    {m.chronic_conditions.length} condition{m.chronic_conditions.length !== 1 && 's'}
                  </span>
                )}
                {m.allergies?.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-1 font-medium">
                    {m.allergies.length} allerg{m.allergies.length !== 1 ? 'ies' : 'y'}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function AddFamilyMemberForm({ onCreated }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [conditions, setConditions] = useState('')
  const [allergies, setAllergies] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const member = await api.post('/api/family-members', {
        name,
        age: age ? parseInt(age, 10) : null,
        chronic_conditions: conditions.split(',').map(s => s.trim()).filter(Boolean),
        allergies: allergies.split(',').map(s => s.trim()).filter(Boolean),
      })
      onCreated(member)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-blue-100 shadow-md p-6 mb-8 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
          <input
            type="number"
            value={age}
            onChange={e => setAge(e.target.value)}
            min="0"
            max="149"
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Chronic conditions <span className="text-gray-400">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={conditions}
            onChange={e => setConditions(e.target.value)}
            placeholder="diabetes, hypertension"
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Allergies <span className="text-gray-400">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={allergies}
            onChange={e => setAllergies(e.target.value)}
            placeholder="penicillin, peanuts"
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-4 border border-red-100">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-5 bg-blue-700 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 min-h-11 shadow-md shadow-blue-200 hover:shadow-lg transition-all"
      >
        {saving ? (
          <span className="inline-flex items-center gap-2">
            <SpinnerIcon className="w-4 h-4" /> Saving...
          </span>
        ) : 'Add Member'}
      </button>
    </form>
  )
}
