import { useState } from 'react'
import { GearSection } from '../gear/GearSection'
import { BeansSection } from './BeansSection'

const SECTIONS = [
  { id: 'beans', label: '🫘 เมล็ด' },
  { id: 'gear', label: '⚙️ อุปกรณ์' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

/** แท็บ "เมล็ด" — รวมคลังเมล็ดและอุปกรณ์ไว้ที่เดียว สลับด้วยปุ่มด้านบน */
export default function BeansPage() {
  const [section, setSection] = useState<SectionId>('beans')

  return (
    <div className="space-y-4">
      <div role="group" aria-label="เลือกหมวด" className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-200 p-1 dark:bg-stone-800">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === section}
            onClick={() => setSection(s.id)}
            className={`min-h-12 rounded-xl text-base font-semibold transition-colors ${
              s.id === section
                ? 'bg-white text-amber-900 shadow-sm dark:bg-stone-600 dark:text-amber-300'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'beans' ? <BeansSection /> : <GearSection />}
    </div>
  )
}
