import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { ToastProvider } from '@/components/ui/Toast'
import { Alteracoes } from '@/pages/Alteracoes'
import { Configuracoes } from '@/pages/Configuracoes'
import { Dashboard } from '@/pages/Dashboard'
import { Estoque } from '@/pages/Estoque'
import { Importar } from '@/pages/Importar'
import { Inventario } from '@/pages/Inventario'
import { Login } from '@/pages/Login'
import { Produto } from '@/pages/Produto'
import { Scanner } from '@/pages/Scanner'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
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
              <Route path="produto/:id" element={<Produto />} />
              <Route path="historico" element={<Alteracoes />} />
              <Route path="importar" element={<Importar />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="configuracoes" element={<Configuracoes />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
