import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { LogoIcon } from './Icons'

export default function Layout() {
  const { session } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-blue-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2.5 text-xl font-extrabold text-blue-700 tracking-tight"
          >
            <LogoIcon className="w-7 h-7" />
            MediLens
          </button>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate('/medicine')}
              className="text-sm text-gray-600 hover:text-blue-700 font-medium min-h-11 px-2 sm:px-3 flex items-center whitespace-nowrap shrink-0 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Medicine Search
            </button>
            <span className="text-sm text-gray-500 hidden sm:block">
              {session?.user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-blue-700 hover:text-blue-900 font-medium min-h-11 px-3 flex items-center rounded-lg hover:bg-blue-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
