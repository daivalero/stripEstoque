import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { HistoricoProvider } from '@/contexts/HistoricoContext'

export function AppLayout() {
  return (
    <HistoricoProvider>
      <div className="flex min-h-dvh bg-bg">
        <Sidebar />

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <Header />

          <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 overflow-x-hidden px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
            <Outlet />
          </main>

          <BottomNav />
        </div>
      </div>
    </HistoricoProvider>
  )
}