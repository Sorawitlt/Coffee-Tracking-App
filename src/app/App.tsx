import { lazy, Suspense, useState } from 'react'
import AssistantPage from '../features/assistant/AssistantPage'
import BeansPage from '../features/beans/BeansPage'
import LogPage from '../features/brew/LogPage'
import { BackupBanner, useBackupReminder } from '../features/export/BackupBanner'
import DataPage from '../features/export/DataPage'

// กราฟ (Recharts) แยกเป็นก้อนโหลดตอนเปิดแท็บ "สรุป" ครั้งแรก — ไม่ถ่วงการเปิดแอปและหน้าชง
const InsightsPage = lazy(() => import('../features/insights/InsightsPage'))

const TABS = [
  { id: 'brew', icon: '☕', label: 'ชง' },
  { id: 'log', icon: '📖', label: 'บันทึก' },
  { id: 'beans', icon: '🫘', label: 'เมล็ด' },
  { id: 'insights', icon: '📊', label: 'สรุป' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('brew')
  // หน้า "ข้อมูลของฉัน" (สำรอง/นำกลับ/ส่งออก) เปิดจากปุ่มมุมบน — ไม่ใช่แท็บหลัก
  const [dataOpen, setDataOpen] = useState(false)
  const reminder = useBackupReminder()
  const goTab = (id: TabId) => {
    setTab(id)
    setDataOpen(false)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <main className="flex-1 p-4">
        <header className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Brew Log</h1>
          <button
            type="button"
            onClick={() => setDataOpen(true)}
            aria-label={`ข้อมูลของฉัน: สำรอง นำกลับ ส่งออก${reminder?.due ? ' (ถึงเวลาสำรองข้อมูล)' : ''}`}
            className="relative flex min-h-12 min-w-12 items-center justify-center rounded-xl text-2xl hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            <span aria-hidden>💾</span>
            {reminder?.due && <span aria-hidden className="absolute right-2 top-2 size-3 rounded-full bg-red-600" />}
          </button>
        </header>
        {/* ไม่แสดงบนแท็บ "ชง" เพื่อไม่ดันตัวจับเวลา — ที่นั่นเตือนด้วยจุดแดงที่ปุ่มข้อมูลแทน */}
        {!dataOpen && tab !== 'brew' && <BackupBanner reminder={reminder} onOpen={() => setDataOpen(true)} />}
        {/* ติดตั้งไว้ตลอด: ถ้ากำลังจับเวลาอยู่ เสียงเตือนและกันจอดับต้องทำงานต่อแม้สลับไปแท็บอื่น */}
        <AssistantPage active={tab === 'brew' && !dataOpen} onGoToBeans={() => goTab('beans')} />
        {dataOpen ? (
          <DataPage onClose={() => setDataOpen(false)} />
        ) : tab === 'beans' ? (
          <BeansPage />
        ) : tab === 'log' ? (
          <LogPage onGoToBeans={() => goTab('beans')} />
        ) : tab === 'insights' ? (
          <Suspense fallback={null}>
            <InsightsPage />
          </Suspense>
        ) : null}
      </main>
      <nav aria-label="เมนูหลัก" className="sticky bottom-0 grid grid-cols-4 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-stone-700 dark:bg-stone-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => goTab(t.id)}
            aria-current={!dataOpen && t.id === tab ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center text-sm ${!dataOpen && t.id === tab ? 'font-semibold text-amber-800 dark:text-amber-400' : 'text-stone-500'}`}
          >
            <span aria-hidden className="text-xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
