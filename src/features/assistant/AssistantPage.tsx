import { useEffect, useState } from 'react'
import { getBean, getRecipe, useLive, type BrewInput } from '../../db'
import { getDefaultRecipe } from '../../domain/recipes'
import { reopenTimer } from '../../domain/timer'
import type { MessageKey } from '../../i18n'
import { useT } from '../../i18n/I18nProvider'
import { formatDuration } from '../format'
import { BrewForm, type BrewFormPrefill } from '../brew/BrewForm'
import { BrewResult } from '../brew/BrewResult'
import { BrewingScreen } from './BrewingScreen'
import { FinishedScreen } from './FinishedScreen'
import {
  clearSession, loadSession, newSession, saveSession, sessionDurationSec, sessionToSaveValues, sessionToSetupValues,
  type AssistantSession,
} from './session'

interface Props {
  /** แท็บ "ชง" กำลังแสดงอยู่ไหม — ถ้าไม่ และกำลังจับเวลา จะยังทำงานอยู่เบื้องหลัง (เสียงเตือนไม่หยุดเมื่อแอบสลับแท็บ) */
  active?: boolean
  /** พาไปแท็บเมล็ดเมื่อยังไม่มีเมล็ดให้เลือก */
  onGoToBeans: () => void
}

interface Notice {
  messageKey: MessageKey
  tone: 'ok' | 'warn'
}

const noop = () => undefined

/**
 * แท็บ "ชง": เตรียมชง → พร้อมชง (ดูขั้นตอน) → จับเวลา + ขั้นตอน → สรุป → บันทึกการชง
 *
 * ตัวเซสชันเก็บใน localStorage ทุกครั้งที่เปลี่ยน → ปิด/เปิดแอปกลางคันแล้วกลับมาชงต่อได้
 * ฟอร์มบันทึกหลังชงมีส่วนชิม & ให้คะแนน แล้วต่อด้วยหน้าคำแนะนำ "ครั้งหน้าลอง …" (ขั้น 6)
 */
export default function AssistantPage({ active = true, onGoToBeans }: Props) {
  const t = useT()
  const [session, setSession] = useState<AssistantSession | undefined>(loadSession)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>()
  /** ค่าตั้งที่กรอกไว้ตอนย้อนกลับจากหน้าพร้อมชงมาแก้ไข */
  const [setupPrefill, setSetupPrefill] = useState<BrewFormPrefill>()
  /** บันทึกแล้วมีคำแนะนำ → แสดงหน้า "ครั้งหน้าลอง …" (เซสชันถูกล้างไปแล้วตั้งแต่ตอนบันทึก) */
  const [result, setResult] = useState<{ brewId: string; messageKey: MessageKey }>()

  // ข้อความยืนยันหายเองหลังไม่กี่วินาที
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(undefined), 4000)
    return () => clearTimeout(timeout)
  }, [notice])

  const beanId = session?.input.beanId
  // ผลลัพธ์ผูกกับ ID ที่ขอ — กันค่าค้างของเซสชันก่อนหน้า (เช่น "ไม่พบ") ไปกระทบเซสชันใหม่
  // bean: `null` = ไม่พบเมล็ด (ถูกลบไปแล้ว), `undefined` = กำลังโหลด
  const beanResult = useLive(async () => (beanId ? { id: beanId, bean: (await getBean(beanId)) ?? null } : undefined), [beanId])
  const bean = beanResult && beanResult.id === beanId ? beanResult.bean : undefined

  function commit(next: AssistantSession | undefined) {
    if (next) saveSession(next)
    else clearSession()
    setSession(next)
  }

  // เมล็ดของการชงที่ค้างอยู่ถูกลบไปแล้ว (เช่น เซสชันเก่าที่ลืมทิ้ง) → ทิ้งเซสชัน ไม่งั้นบันทึกไม่ได้
  useEffect(() => {
    if (session && bean === null) {
      commit(undefined)
      setSaving(false)
      setNotice({ messageKey: 'assistant.beanDeleted', tone: 'warn' })
    }
  }, [session, bean])

  async function start(input: BrewInput) {
    // ใช้สูตรที่ผูกกับการชงนี้ (ถ้ามี) ไม่งั้นสูตรตั้งต้นของวิธีนั้น — ปรับเป้าน้ำหนักตามน้ำที่ตั้ง
    let recipe = input.recipeId ? await getRecipe(input.recipeId).catch(() => undefined) : undefined
    if (!recipe || recipe.method !== input.method) recipe = getDefaultRecipe(input.method)
    setSetupPrefill(undefined)
    setNotice(undefined)
    commit(
      newSession(
        {
          method: input.method,
          beanId: input.beanId,
          recipeId: recipe.id,
          grinderId: input.grinderId,
          brewerId: input.brewerId,
          grindSetting: input.grindSetting,
          doseG: input.doseG,
          waterG: input.waterG,
          tempC: input.tempC,
        },
        recipe,
      ),
    )
  }

  function editSetup() {
    if (!session) return
    setSetupPrefill({ values: sessionToSetupValues(session) })
    commit(undefined)
  }

  function saved(messageKey?: MessageKey, adviceBrewId?: string) {
    setSaving(false)
    if (!messageKey) return // กดยกเลิกในฟอร์ม → กลับไปหน้าสรุป ผลการชงยังอยู่
    // ล้างเซสชันทันทีที่บันทึกสำเร็จ — ปิดแอปที่หน้าคำแนะนำแล้วกลับมาต้องไม่เห็นหน้าสรุปให้บันทึกซ้ำ
    commit(undefined)
    if (adviceBrewId) setResult({ brewId: adviceBrewId, messageKey })
    else setNotice({ messageKey, tone: 'ok' })
  }

  function closeResult() {
    if (result) setNotice({ messageKey: result.messageKey, tone: 'ok' })
    setResult(undefined)
  }

  const finished = session?.timer.status === 'finished'
  // กำลังจับเวลาอยู่ต้องคงอยู่เบื้องหลังเสมอ (เสียงเตือน + กันจอดับ) แม้ผู้ใช้สลับไปแท็บอื่น
  const timing = session !== undefined && !finished
  if (!active && !timing) return null

  return (
    <div hidden={!active}>
      {notice && (
        <p
          role="status"
          className={`mb-3 rounded-xl p-3 text-center text-sm font-medium ${
            notice.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200'
          }`}
        >
          {notice.tone === 'ok' ? '✓ ' : ''}{t(notice.messageKey)}
        </p>
      )}

      {/* key แยกฟอร์มเตรียมชงกับฟอร์มบันทึก — เป็นคอมโพเนนต์เดียวกัน ถ้าไม่แยก React จะใช้ state เดิมต่อ */}
      {!session && result ? (
        <BrewResult key="result" brewId={result.brewId} messageKey={result.messageKey} onDone={closeResult} />
      ) : !session ? (
        <BrewForm key="setup" mode="start" prefill={setupPrefill} onStart={(input) => void start(input)} onDone={noop} onGoToBeans={onGoToBeans} />
      ) : finished && saving ? (
        <BrewForm
          key="save"
          mode="new"
          prefill={{
            values: sessionToSaveValues(session, Date.now()),
            note: t('assistant.prefillNote', { time: formatDuration(sessionDurationSec(session, Date.now())) }),
          }}
          onDone={saved}
          onGoToBeans={onGoToBeans}
        />
      ) : finished ? (
        <FinishedScreen
          session={session}
          bean={bean}
          onSave={() => setSaving(true)}
          onReopen={() => commit({ ...session, timer: reopenTimer(session.timer) })}
          onDiscard={() => commit(undefined)}
        />
      ) : (
        <BrewingScreen
          session={session}
          bean={bean}
          onChange={commit}
          onCancel={() => commit(undefined)}
          onEdit={editSetup}
        />
      )}
    </div>
  )
}
