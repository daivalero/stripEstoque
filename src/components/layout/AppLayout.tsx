import { Outlet } from 'react-router-dom'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Header />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
