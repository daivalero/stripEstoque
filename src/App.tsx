import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { ToastProvider } from '@/components/ui/Toast'

const Login = lazy(() =>
  import('@/pages/Login').then((module) => ({ default: module.Login })),
)
const Dashboard = lazy(() =>
  import('@/pages/Dashboard').then((module) => ({ default: module.Dashboard })),
)
const Scanner = lazy(() =>
  import('@/pages/Scanner').then((module) => ({ default: module.Scanner })),
)
const Estoque = lazy(() =>
  import('@/pages/Estoque').then((module) => ({ default: module.Estoque })),
)
const Alteracoes = lazy(() =>
  import('@/pages/Alteracoes').then((module) => ({
    default: module.Alteracoes,
  })),
)
const Importar = lazy(() =>
  import('@/pages/Importar').then((module) => ({ default: module.Importar })),
)
const Inventario = lazy(() =>
  import('@/pages/Inventario').then((module) => ({
    default: module.Inventario,
  })),
)
const Configuracoes = lazy(() =>
  import('@/pages/Configuracoes').then((module) => ({
    default: module.Configuracoes,
  })),
)

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <DashboardSkeleton />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="scanner" element={<Scanner />} />
                <Route path="estoque" element={<Estoque />} />
                <Route path="historico" element={<Alteracoes />} />
                <Route path="importar" element={<Importar />} />
                <Route path="inventario" element={<Inventario />} />
                <Route path="configuracoes" element={<Configuracoes />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
