import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingState } from './StateViews'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) return <LoadingState label="Checking your session…" fullScreen />

  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
