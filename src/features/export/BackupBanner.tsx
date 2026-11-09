import { useState } from 'react'
import { db, getSettings, useLive } from '../../db'
import { backupReminder, type BackupReminder } from '../../domain/backup'
import { Button } from '../../components/Button'
import { useT } from '../../i18n/I18nProvider'
import { daysAgoText } from './backupText'
import { isSnoozed, snoozeReminder } from './reminder'

/** เวลาที่สร้างข้อมูลชิ้นแรก (เมล็ด/อุปกรณ์/บันทึกการชง) — จุดเริ่มนับเมื่อยังไม่เคยสำรอง */
async function firstDataAt(): Promise<string | undefined> {
  let first: string | undefined
  for (const table of [db.beans, db.gear, db.brews]) {
    await table.each((row) => {
      if (first === undefined || row.createdAt < first) first = row.createdAt
    })
  }
  return first
}

/** ถึงเวลาเตือนสำรองข้อมูลหรือยัง (`undefined` = กำลังโหลด) — อัปเดตสดเมื่อข้อมูลหรือการสำรองเปลี่ยน */
export function useBackupReminder(): BackupReminder | undefined {
  const state = useLive(async () => ({ lastBackupAt: (await getSettings()).lastBackupAt, firstDataAt: await firstDataAt() }))
  if (!state) return undefined
  return backupReminder({
    lastBackupAt: state.lastBackupAt,
    firstDataAt: state.firstDataAt,
    hasData: state.firstDataAt !== undefined,
    now: new Date(),
  })
}

interface Props {
  reminder: BackupReminder | undefined
  /** กด "สำรองเลย" → เปิดหน้าข้อมูล */
  onOpen: () => void
}

/** แบนเนอร์เตือนสำรองข้อมูลทุก 2 สัปดาห์ — ไม่แสดงเมื่อยังไม่มีข้อมูลหรือกด "ไว้ทีหลัง" อยู่ */
export function BackupBanner({ reminder, onOpen }: Props) {
  const t = useT()
  const [snoozed, setSnoozed] = useState(() => isSnoozed())
  if (!reminder?.due || snoozed) return null

  return (
    <section
      aria-label={t('banner.aria')}
      className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-stone-900 dark:border-amber-700 dark:bg-amber-950 dark:text-stone-100"
    >
      <p className="font-semibold">
        {t(reminder.neverBackedUp ? 'banner.never' : 'banner.due')}
      </p>
      <p className="mt-1 text-sm">
        {reminder.neverBackedUp
          ? t('banner.sinceStart', { when: daysAgoText(reminder.daysSince ?? 0, t) })
          : t('banner.sinceBackup', { when: daysAgoText(reminder.daysSince ?? 0, t) })}
        {t('banner.warning')}
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={onOpen}>{t('banner.now')}</Button>
        <Button
          variant="ghost"
          onClick={() => {
            snoozeReminder()
            setSnoozed(true)
          }}
        >
          {t('banner.later')}
        </Button>
      </div>
    </section>
  )
}
