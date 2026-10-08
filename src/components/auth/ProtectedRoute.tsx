import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <DashboardSkeleton />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
