import { useState } from 'react'
import { getBean, getBrew, setBestBrew, useLive } from '../../db'
import { Button } from '../../components/Button'
import type { MessageKey } from '../../i18n'
import { useI18n } from '../../i18n/I18nProvider'
import { METHOD_LABEL } from '../labels'
import { describeAdvice } from './adviceText'

interface Props {
  brewId: string
  /** คีย์ข้อความยืนยันที่แสดงหัวหน้า (เช่น "บันทึกการชงแล้ว") */
  messageKey?: MessageKey
  onDone: () => void
}

/**
 * หน้าหลังบันทึก: "ครั้งหน้าลอง …" (PLAN ข้อ 4 — Flow หลัก) + ติดดาวสูตรที่ดีที่สุด
 * ข้อความมาจากคำแนะนำที่เก็บไว้กับบันทึก (snapshot ตอนบันทึก) ไม่คำนวณใหม่
 */
export function BrewResult({ brewId, messageKey = 'brew.msg.saved', onDone }: Props) {
  const { t } = useI18n()
  // `null` = ไม่พบ (ถูกลบไปแล้ว), `undefined` = กำลังโหลด
  const brew = useLive(() => getBrew(brewId).then((b) => b ?? null), [brewId])
  const bean = useLive(async () => (brew ? ((await getBean(brew.beanId)) ?? null) : undefined), [brew?.beanId])
  const [error, setError] = useState<MessageKey>()
  const [busy, setBusy] = useState(false)

  if (brew === undefined) return null
  if (brew === null || !brew.advice) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          ✓ {t(messageKey)}
        </p>
        <Button variant="primary" className="w-full" onClick={onDone}>{t('common.done')}</Button>
      </div>
    )
  }

  const view = describeAdvice(brew.advice, brew.method, t)

  async function toggleBest() {
    if (!brew) return
    setError(undefined)
    setBusy(true)
    try {
      await setBestBrew(brew.id, !brew.isBest)
    } catch {
      setError('common.errorRetry')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={t('advice.sectionLabel')} className="space-y-4">
      <p role="status" className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        ✓ {t(messageKey)}
        {brew.rating !== undefined && <span aria-label={t('common.stars', { n: brew.rating })}> · {'★'.repeat(brew.rating)}</span>}
      </p>

      <div
        className={`rounded-2xl border p-4 ${
          view.positive
            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
            : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
        }`}
      >
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {METHOD_LABEL[brew.method]} · {bean ? bean.name : t('common.bean')}
        </p>
        <p className="mt-1 font-medium">{view.diagnosis}</p>
        {view.action ? (
          <>
            <p className="mt-3 text-sm font-medium text-stone-600 dark:text-stone-400">{t('advice.nextTry')}</p>
            <p className="text-xl font-bold">{view.action}</p>
          </>
        ) : (
          view.fallback && <p className="mt-3 text-base font-semibold">{view.fallback}</p>
        )}
        {view.alternatives.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-stone-600 dark:text-stone-400">{t('advice.alternatives')}</p>
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

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">{t(error)}</p>}

      <Button
        variant={brew.advice.kind === 'best' && !brew.isBest ? 'primary' : 'secondary'}
        className="w-full"
        aria-pressed={brew.isBest}
        disabled={busy}
        onClick={() => void toggleBest()}
      >
        {t(brew.isBest ? 'advice.bestOn' : 'advice.bestOff')}
      </Button>
      <Button variant={brew.advice.kind === 'best' && !brew.isBest ? 'secondary' : 'primary'} className="w-full" onClick={onDone}>
        {t('common.done')}
      </Button>
    </section>
  )
}
