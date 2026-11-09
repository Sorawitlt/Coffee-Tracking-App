import { useState } from 'react'

const TABS = [
  { id: 'brew', icon: '☕', label: 'ชง' },
  { id: 'log', icon: '📖', label: 'บันทึก' },
  { id: 'beans', icon: '🫘', label: 'เมล็ด' },
  { id: 'insights', icon: '📊', label: 'สรุป' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('brew')
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <main className="flex-1 p-4">
        <h1 className="text-2xl font-bold">Brew Log</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          {current.icon} {current.label} — เร็ว ๆ นี้
        </p>
      </main>
      <nav aria-label="เมนูหลัก" className="sticky bottom-0 grid grid-cols-4 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-stone-700 dark:bg-stone-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={t.id === tab ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center text-sm ${t.id === tab ? 'font-semibold text-amber-800 dark:text-amber-400' : 'text-stone-500'}`}
          >
            <span aria-hidden className="text-xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
