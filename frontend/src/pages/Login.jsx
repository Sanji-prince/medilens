import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogoIcon, SpinnerIcon } from '../components/Icons'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const demoStarted = useRef(false)
  const demoMode = searchParams.get('mode') === 'demo'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email to confirm your account, then sign in.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard')
      }
    }

    setLoading(false)
  }

  const handleDemoLogin = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/demo/login', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Demo login failed')

      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (error) throw error

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (!demoMode || demoStarted.current) return
    demoStarted.current = true
    void handleDemoLogin()
  }, [demoMode, handleDemoLogin])

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 px-4 animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-blue-100 border border-blue-100 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-700 text-white flex items-center justify-center mb-3 shadow-lg shadow-blue-200">
            <LogoIcon className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-blue-700 text-center tracking-tight">MediLens</h1>
          <p className="text-gray-500 text-center text-sm mt-1">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-100">{error}</p>
          )}
          {message && (
            <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2 border border-green-100">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-blue-800 disabled:opacity-50 min-h-11 shadow-md shadow-blue-200 hover:shadow-lg transition-all"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <SpinnerIcon className="w-4 h-4" /> Please wait…
              </span>
            ) : isSignUp ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
          className="mt-4 w-full text-sm text-blue-700 hover:text-blue-900 text-center font-medium"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full bg-white text-blue-700 border border-blue-200 rounded-xl py-2.5 text-sm font-bold hover:bg-blue-50 disabled:opacity-50 min-h-11 transition-colors"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <SpinnerIcon className="w-4 h-4" /> Please wait…
              </span>
            ) : 'Try Demo'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Signs in as a read-only demo account
          </p>
        </div>
      </div>
    </div>
  )
}
