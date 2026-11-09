import { useState } from 'react'
import { Button } from '../../components/Button'
import { formatRatio, ratio } from '../../domain/calc'
import { METHOD_PROFILES } from '../../domain/methods'
import type { Bean } from '../../domain/types'
import { formatDuration, formatGrams } from '../format'
import { METHOD_LABEL } from '../labels'
import { sessionDurationSec, type AssistantSession } from './session'

interface Props {
  session: AssistantSession
  bean?: Bean | null
  onSave: () => void
  /** กดจบพลาด → กลับไปจับเวลาต่อ */
  onReopen: () => void
  onDiscard: () => void
}

/** สรุปหลังจบการชง — ผลยังไม่ถูกบันทึกจนกว่าจะกด "บันทึกการชง" (ปิดแอปแล้วกลับมายังอยู่) */
export function FinishedScreen({ session, bean, onSave, onReopen, onDiscard }: Props) {
  const { input } = session
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const seconds = sessionDurationSec(session, 0)
  const [lo, hi] = METHOD_PROFILES[input.method].timeRangeSec

  return (
    <section aria-label="ชงเสร็จแล้ว" className="space-y-4">
      <header className="text-center">
        <p className="text-5xl" aria-hidden>☕</p>
        <h2 className="mt-2 text-xl font-bold">ชงเสร็จแล้ว</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {METHOD_LABEL[input.method]} · {bean ? bean.name : 'เมล็ด'}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
          <dt className="text-sm text-stone-600 dark:text-stone-400">เวลาชงจริง</dt>
          <dd className="text-4xl font-bold tabular-nums">{formatDuration(seconds)}</dd>
          <dd className="text-xs text-stone-500 dark:text-stone-400">
            เป้าหมาย {formatDuration(lo)}{hi !== lo && `–${formatDuration(hi)}`}
          </dd>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
          <dt className="text-sm text-stone-600 dark:text-stone-400">อัตราส่วน</dt>
          <dd className="text-4xl font-bold tabular-nums">{formatRatio(ratio(input.doseG, input.waterG))}</dd>
          <dd className="text-xs text-stone-500 dark:text-stone-400">
            {formatGrams(input.doseG)} g : {formatGrams(input.waterG)} g
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        <Button variant="primary" className="h-14 w-full text-lg" onClick={onSave}>บันทึกการชง</Button>
        <Button className="w-full" onClick={onReopen}>↩ กลับไปจับเวลาต่อ</Button>
        {!confirmDiscard ? (
          <Button variant="ghost" className="w-full text-red-700 dark:text-red-400" onClick={() => setConfirmDiscard(true)}>
            ทิ้งผลการชงนี้
          </Button>
        ) : (
          <div role="alertdialog" aria-label="ยืนยันการทิ้ง" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
            <p className="text-sm font-medium">ทิ้งผลการชงนี้? จะไม่ถูกบันทึกและไม่หักน้ำหนักเมล็ด</p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => setConfirmDiscard(false)}>ไม่ทิ้ง</Button>
              <Button variant="danger" className="flex-1" onClick={onDiscard}>ยืนยันทิ้ง</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
