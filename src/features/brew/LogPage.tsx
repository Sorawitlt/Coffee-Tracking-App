import { useEffect, useState } from 'react'
import { getBrew, listBeans, listBrews, useLive } from '../../db'
import { Button } from '../../components/Button'
import { filterBrews, isFilterActive, type BrewFilter } from '../../domain/history'
import { FLAVOR_TAG_LABEL, METHOD_LABEL } from '../labels'
import type { Method } from '../../domain/types'
import { isFlavorTag } from '../../domain/flavors'
import { BrewFilters } from './BrewFilters'
import { BrewCard } from './BrewCard'
import { BrewForm } from './BrewForm'
import { BrewResult } from './BrewResult'

const PAGE_SIZE = 50

/** ให้ค้นหาด้วยป้ายภาษาไทย เช่น พิมพ์ "ซิตรัส" แล้วเจอแท็ก citrus */
const SEARCH_LABELS = {
  method: (m: Method) => METHOD_LABEL[m],
  flavorTag: (code: string) => (isFlavorTag(code) ? FLAVOR_TAG_LABEL[code] : code),
}

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'repeat'; id: string }
  | { kind: 'edit'; id: string }
  /** หลังบันทึก: หน้า "ครั้งหน้าลอง …" */
  | { kind: 'result'; id: string; message: string }

interface Props {
  /** พาไปแท็บเมล็ดเมื่อยังไม่มีเมล็ดให้เลือก */
  onGoToBeans: () => void
}

/** แท็บ "บันทึก": รายการบันทึกการชง + ฟอร์มบันทึกเร็ว / ชงซ้ำ / แก้ไข */
export default function LogPage({ onGoToBeans }: Props) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [notice, setNotice] = useState<string>()

  // ข้อความยืนยันหายเองหลังไม่กี่วินาที
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(undefined), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const toList = (message?: string) => {
    setNotice(message)
    setView({ kind: 'list' })
  }
  // บันทึกแล้วมีคำแนะนำ → ไปหน้าคำแนะนำก่อน แล้วค่อยกลับรายการ
  const afterForm = (message?: string, adviceBrewId?: string) => {
    if (message && adviceBrewId) setView({ kind: 'result', id: adviceBrewId, message })
    else toList(message)
  }

  if (view.kind === 'new') return <BrewForm mode="new" onDone={afterForm} onGoToBeans={onGoToBeans} />
  if (view.kind === 'repeat' || view.kind === 'edit') {
    return <BrewById key={`${view.kind}-${view.id}`} id={view.id} mode={view.kind} onDone={afterForm} onGoToBeans={onGoToBeans} />
  }
  if (view.kind === 'result') {
    return <BrewResult brewId={view.id} message={view.message} onDone={() => toList(view.message)} />
  }
  return (
    <BrewList
      notice={notice}
      onAdd={() => { setNotice(undefined); setView({ kind: 'new' }) }}
      onOpen={(id) => setView({ kind: 'edit', id })}
      onRepeat={(id) => { setNotice(undefined); setView({ kind: 'repeat', id }) }}
    />
  )
}

function BrewById({ id, mode, onDone, onGoToBeans }: {
  id: string
  mode: 'repeat' | 'edit'
  onDone: (message?: string, adviceBrewId?: string) => void
  onGoToBeans: () => void
}) {
  // `null` = ไม่พบ (เช่น ถูกลบไปแล้ว), `undefined` = กำลังโหลด
  const brew = useLive(() => getBrew(id).then((b) => b ?? null), [id])
  useEffect(() => {
    if (brew === null) onDone()
  }, [brew, onDone])
  if (!brew) return null
  return <BrewForm mode={mode} brew={brew} onDone={onDone} onGoToBeans={onGoToBeans} />
}

function BrewList({ notice, onAdd, onOpen, onRepeat }: {
  notice?: string
  onAdd: () => void
  onOpen: (id: string) => void
  onRepeat: (id: string) => void
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [filter, setFilter] = useState<BrewFilter>({})
  const brews = useLive(() => listBrews())
  const beanList = useLive(() => listBeans({ includeArchived: true }))
  const beans = beanList && new Map(beanList.map((b) => [b.id, b]))
  const visible = brews && beans ? filterBrews(brews, filter, beans, SEARCH_LABELS) : undefined
  const changeFilter = (next: BrewFilter) => {
    setFilter(next)
    setLimit(PAGE_SIZE) // ผลลัพธ์เปลี่ยน → เริ่มนับหน้าใหม่
  }

  return (
    <section aria-label="บันทึกการชง" className="space-y-3">
      <Button variant="primary" className="w-full" onClick={onAdd}>
        + บันทึกการชง
      </Button>

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          ✓ {notice}
        </p>
      )}

      {brews !== undefined && beanList !== undefined && brews.length > 0 && (
        <BrewFilters filter={filter} onChange={changeFilter} beans={beanList} shown={visible?.length ?? 0} total={brews.length} />
      )}

      {brews === undefined || beans === undefined || visible === undefined ? null : brews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>📖</p>
          <p className="mt-2 font-medium">ยังไม่มีบันทึกการชง</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            กดปุ่มด้านบนเพื่อบันทึกแก้วแรก — ครั้งต่อไปแอปจะเติมค่าจากครั้งล่าสุดให้ และกด “ชงซ้ำ” ได้ทันที
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p role="status" className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600 dark:border-stone-600 dark:text-stone-400">
          ไม่พบบันทึกที่ตรงกับ{isFilterActive(filter) ? 'ตัวกรอง' : 'เงื่อนไข'}นี้
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {visible.slice(0, limit).map((b) => (
              <li key={b.id}>
                <BrewCard brew={b} bean={beans.get(b.beanId)} onOpen={() => onOpen(b.id)} onRepeat={() => onRepeat(b.id)} />
              </li>
            ))}
          </ul>
          {visible.length > limit && (
            <Button className="w-full" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              แสดงเพิ่ม ({visible.length - limit})
            </Button>
          )}
        </>
      )}
    </section>
  )
}
