import { useState } from 'react'
import { listBeans, useLive } from '../../db'
import { Button } from '../../components/Button'
import { BeanCard } from './BeanCard'

interface Props {
  onAdd: () => void
  onOpen: (id: string) => void
}

export function BeanList({ onAdd, onOpen }: Props) {
  const [showArchived, setShowArchived] = useState(false)
  const beans = useLive(() => listBeans({ includeArchived: showArchived }), [showArchived])
  const archivedCount = useLive(async () => (await listBeans({ includeArchived: true })).filter((b) => b.archived).length, [])

  return (
    <section aria-label="คลังเมล็ด" className="space-y-3">
      <Button variant="primary" className="w-full" onClick={onAdd}>
        + เพิ่มเมล็ด
      </Button>

      {beans === undefined ? null : beans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>🫘</p>
          <p className="mt-2 font-medium">{showArchived ? 'ไม่มีเมล็ดในคลัง' : 'ยังไม่มีเมล็ดในคลัง'}</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            เพิ่มถุงแรกของคุณ แอปจะนับวันหลังคั่วและหักน้ำหนักคงเหลือให้อัตโนมัติ
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {beans.map((b) => (
            <li key={b.id}>
              <BeanCard bean={b} onOpen={() => onOpen(b.id)} />
            </li>
          ))}
        </ul>
      )}

      {(archivedCount ?? 0) > 0 && (
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="size-5 accent-amber-800"
          />
          แสดงที่ Archive ({archivedCount})
        </label>
      )}
    </section>
  )
}
