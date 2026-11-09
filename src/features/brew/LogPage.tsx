import { useEffect, useState } from 'react'
import { getBrew, listBeans, listBrews, useLive } from '../../db'
import { Button } from '../../components/Button'
import { BrewCard } from './BrewCard'
import { BrewForm } from './BrewForm'

const PAGE_SIZE = 50

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'repeat'; id: string } | { kind: 'edit'; id: string }

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

  if (view.kind === 'new') return <BrewForm mode="new" onDone={toList} onGoToBeans={onGoToBeans} />
  if (view.kind === 'repeat' || view.kind === 'edit') {
    return <BrewById key={`${view.kind}-${view.id}`} id={view.id} mode={view.kind} onDone={toList} onGoToBeans={onGoToBeans} />
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
  onDone: (message?: string) => void
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
  const brews = useLive(() => listBrews())
  const beans = useLive(async () => new Map((await listBeans({ includeArchived: true })).map((b) => [b.id, b])))

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

      {brews === undefined || beans === undefined ? null : brews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>📖</p>
          <p className="mt-2 font-medium">ยังไม่มีบันทึกการชง</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            กดปุ่มด้านบนเพื่อบันทึกแก้วแรก — ครั้งต่อไปแอปจะเติมค่าจากครั้งล่าสุดให้ และกด “ชงซ้ำ” ได้ทันที
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {brews.slice(0, limit).map((b) => (
              <li key={b.id}>
                <BrewCard brew={b} bean={beans.get(b.beanId)} onOpen={() => onOpen(b.id)} onRepeat={() => onRepeat(b.id)} />
              </li>
            ))}
          </ul>
          {brews.length > limit && (
            <Button className="w-full" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              แสดงเพิ่ม ({brews.length - limit})
            </Button>
          )}
        </>
      )}
    </section>
  )
}
