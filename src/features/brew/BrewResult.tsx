import { useState } from 'react'
import { getBean, getBrew, setBestBrew, useLive } from '../../db'
import { Button } from '../../components/Button'
import { METHOD_LABEL } from '../labels'
import { describeAdvice } from './adviceText'

interface Props {
  brewId: string
  /** ข้อความยืนยันที่แสดงหัวหน้า (เช่น "บันทึกการชงแล้ว") */
  message?: string
  onDone: () => void
}

/**
 * หน้าหลังบันทึก: "ครั้งหน้าลอง …" (PLAN ข้อ 4 — Flow หลัก) + ติดดาวสูตรที่ดีที่สุด
 * ข้อความมาจากคำแนะนำที่เก็บไว้กับบันทึก (snapshot ตอนบันทึก) ไม่คำนวณใหม่
 */
export function BrewResult({ brewId, message = 'บันทึกการชงแล้ว', onDone }: Props) {
  // `null` = ไม่พบ (ถูกลบไปแล้ว), `undefined` = กำลังโหลด
  const brew = useLive(() => getBrew(brewId).then((b) => b ?? null), [brewId])
  const bean = useLive(async () => (brew ? ((await getBean(brew.beanId)) ?? null) : undefined), [brew?.beanId])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  if (brew === undefined) return null
  if (brew === null || !brew.advice) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          ✓ {message}
        </p>
        <Button variant="primary" className="w-full" onClick={onDone}>เสร็จสิ้น</Button>
      </div>
    )
  }

  const view = describeAdvice(brew.advice, brew.method)

  async function toggleBest() {
    if (!brew) return
    setError(undefined)
    setBusy(true)
    try {
      await setBestBrew(brew.id, !brew.isBest)
    } catch {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="คำแนะนำสำหรับครั้งหน้า" className="space-y-4">
      <p role="status" className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        ✓ {message}
        {brew.rating !== undefined && <span aria-label={`${brew.rating} ดาว`}> · {'★'.repeat(brew.rating)}</span>}
      </p>

      <div
        className={`rounded-2xl border p-4 ${
          view.positive
            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
            : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
        }`}
      >
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {METHOD_LABEL[brew.method]} · {bean ? bean.name : 'เมล็ด'}
        </p>
        <p className="mt-1 font-medium">{view.diagnosis}</p>
        {view.action ? (
          <>
            <p className="mt-3 text-sm font-medium text-stone-600 dark:text-stone-400">ครั้งหน้าลอง (ปรับแค่อย่างเดียว)</p>
            <p className="text-xl font-bold">{view.action}</p>
          </>
        ) : (
          view.fallback && <p className="mt-3 text-base font-semibold">{view.fallback}</p>
        )}
        {view.alternatives.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-stone-600 dark:text-stone-400">หรือเลือกอย่างใดอย่างหนึ่งแทน</p>
            <ul className="list-disc pl-5">
              {view.alternatives.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>

      {view.notes.map((n) => (
        <p key={n} className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          💡 {n}
        </p>
      ))}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

      <Button
        variant={brew.advice.kind === 'best' && !brew.isBest ? 'primary' : 'secondary'}
        className="w-full"
        aria-pressed={brew.isBest}
        disabled={busy}
        onClick={() => void toggleBest()}
      >
        {brew.isBest ? '⭐ เป็นสูตรที่ดีที่สุดของเมล็ดนี้ (กดเพื่อยกเลิก)' : '⭐ บันทึกเป็นสูตรที่ดีที่สุดของเมล็ดนี้'}
      </Button>
      <Button variant={brew.advice.kind === 'best' && !brew.isBest ? 'secondary' : 'primary'} className="w-full" onClick={onDone}>
        เสร็จสิ้น
      </Button>
    </section>
  )
}
