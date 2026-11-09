import { useEffect, useState } from 'react'
import { getBrew, listBeans, listBrews, useLive } from '../../db'
import { Button } from '../../components/Button'
import { filterBrews, isFilterActive, type BrewFilter } from '../../domain/history'
import type { MessageKey, TFunction } from '../../i18n'
import { useT } from '../../i18n/I18nProvider'
import { FLAVOR_TAG_KEY, METHOD_LABEL } from '../labels'
import type { Method } from '../../domain/types'
import { isFlavorTag } from '../../domain/flavors'
import { BrewFilters } from './BrewFilters'
import { BrewCard } from './BrewCard'
import { BrewForm } from './BrewForm'
import { BrewResult } from './BrewResult'

const PAGE_SIZE = 50

/** ให้ค้นหาด้วยป้ายตามภาษาที่ใช้อยู่ เช่น พิมพ์ "ซิตรัส" (หรือ "citrus") แล้วเจอแท็ก citrus */
const searchLabels = (t: TFunction) => ({
  method: (m: Method) => METHOD_LABEL[m],
  flavorTag: (code: string) => (isFlavorTag(code) ? t(FLAVOR_TAG_KEY[code]) : code),
})

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'repeat'; id: string }
  | { kind: 'edit'; id: string }
  /** หลังบันทึก: หน้า "ครั้งหน้าลอง …" */
  | { kind: 'result'; id: string; messageKey: MessageKey }

interface Props {
  /** พาไปแท็บเมล็ดเมื่อยังไม่มีเมล็ดให้เลือก */
  onGoToBeans: () => void
}

/** แท็บ "บันทึก": รายการบันทึกการชง + ฟอร์มบันทึกเร็ว / ชงซ้ำ / แก้ไข */
export default function LogPage({ onGoToBeans }: Props) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [notice, setNotice] = useState<MessageKey>()

  // ข้อความยืนยันหายเองหลังไม่กี่วินาที
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(undefined), 4000)
    return () => clearTimeout(timeout)
  }, [notice])

  const toList = (messageKey?: MessageKey) => {
    setNotice(messageKey)
    setView({ kind: 'list' })
  }
  // บันทึกแล้วมีคำแนะนำ → ไปหน้าคำแนะนำก่อน แล้วค่อยกลับรายการ
  const afterForm = (messageKey?: MessageKey, adviceBrewId?: string) => {
    if (messageKey && adviceBrewId) setView({ kind: 'result', id: adviceBrewId, messageKey })
    else toList(messageKey)
  }

  if (view.kind === 'new') return <BrewForm mode="new" onDone={afterForm} onGoToBeans={onGoToBeans} />
  if (view.kind === 'repeat' || view.kind === 'edit') {
    return <BrewById key={`${view.kind}-${view.id}`} id={view.id} mode={view.kind} onDone={afterForm} onGoToBeans={onGoToBeans} />
  }
  if (view.kind === 'result') {
    return <BrewResult brewId={view.id} messageKey={view.messageKey} onDone={() => toList(view.messageKey)} />
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
  onDone: (messageKey?: MessageKey, adviceBrewId?: string) => void
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
  notice?: MessageKey
  onAdd: () => void
  onOpen: (id: string) => void
  onRepeat: (id: string) => void
}) {
  const t = useT()
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [filter, setFilter] = useState<BrewFilter>({})
  const brews = useLive(() => listBrews())
  const beanList = useLive(() => listBeans({ includeArchived: true }))
  const beans = beanList && new Map(beanList.map((b) => [b.id, b]))
  const visible = brews && beans ? filterBrews(brews, filter, beans, searchLabels(t)) : undefined
  const changeFilter = (next: BrewFilter) => {
    setFilter(next)
    setLimit(PAGE_SIZE) // ผลลัพธ์เปลี่ยน → เริ่มนับหน้าใหม่
  }

  return (
    <section aria-label={t('log.title')} className="space-y-3">
      <Button variant="primary" className="w-full" onClick={onAdd}>
        {t('log.add')}
      </Button>

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          ✓ {t(notice)}
        </p>
      )}

      {brews !== undefined && beanList !== undefined && brews.length > 0 && (
        <BrewFilters filter={filter} onChange={changeFilter} beans={beanList} shown={visible?.length ?? 0} total={brews.length} />
      )}

      {brews === undefined || beans === undefined || visible === undefined ? null : brews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>📖</p>
          <p className="mt-2 font-medium">{t('log.empty')}</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            {t('log.emptyHint')}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p role="status" className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600 dark:border-stone-600 dark:text-stone-400">
          {t(isFilterActive(filter) ? 'log.noMatchFilter' : 'log.noMatchSearch')}
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
              {t('log.showMore', { n: visible.length - limit })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
