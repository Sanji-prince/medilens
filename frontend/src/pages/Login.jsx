import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogoIcon } from '../components/Icons'
import { ErrorState, InlineSpinner, LoadingState } from '../components/StateViews'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const demoStarted = useRef(false)
  const demoMode = searchParams.get('mode') === 'demo'
  const isBusy = loading || demoLoading

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
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
    } catch (err) {
      setError(err.message || 'Unable to complete your request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = useCallback(async () => {
    setDemoLoading(true)
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
      setError(err.message || 'Unable to start the demo. Please try again.')
    } finally {
      setDemoLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (!demoMode || demoStarted.current) return
    demoStarted.current = true
    void handleDemoLogin()
  }, [demoMode, handleDemoLogin])

  const errorTitle = demoMode
    ? 'Unable to start demo'
    : isSignUp ? 'Unable to create account' : 'Unable to sign in'

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 px-4 animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-blue-100 border border-blue-100 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-700 text-white flex items-center justify-center mb-3 shadow-lg shadow-blue-200">
            <LogoIcon className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-blue-700 text-center tracking-tight">MediLens</h1>
          <p className="text-gray-500 text-center text-sm mt-1">
            {demoMode && demoLoading ? 'Starting your demo…' : isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {demoMode && demoLoading ? (
          <LoadingState label="Starting your demo…" className="py-8" />
        ) : (
          <>
            {error && (
              <ErrorState
                title={errorTitle}
                message={error}
                onRetry={demoMode ? handleDemoLogin : undefined}
                retryLabel="Try demo again"
                className="mb-4 p-4"
              />
            )}
            {message && (
              <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2 border border-green-100" role="status" aria-live="polite">{message}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={isBusy}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:opacity-50"
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
                  disabled={isBusy}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="w-full bg-blue-700 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-blue-800 disabled:opacity-50 min-h-11 shadow-md shadow-blue-200 hover:shadow-lg transition-all"
              >
                {loading ? <InlineSpinner label="Signing in…" /> : isSignUp ? 'Sign up' : 'Sign in'}
              </button>
            </form>

            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              disabled={isBusy}
              className="mt-4 w-full text-sm text-blue-700 hover:text-blue-900 text-center font-medium disabled:opacity-50"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isBusy}
                className="w-full bg-white text-blue-700 border border-blue-200 rounded-xl py-2.5 text-sm font-bold hover:bg-blue-50 disabled:opacity-50 min-h-11 transition-colors"
              >
                {demoLoading ? <InlineSpinner label="Starting demo…" /> : 'Try Demo'}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Explore sample family data and add your own family members.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
