import { useState } from 'react'
import { db, getSettings, useLive } from '../../db'
import { backupReminder, type BackupReminder } from '../../domain/backup'
import { Button } from '../../components/Button'
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
  const [snoozed, setSnoozed] = useState(() => isSnoozed())
  if (!reminder?.due || snoozed) return null

  return (
    <section
      aria-label="เตือนสำรองข้อมูล"
      className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-stone-900 dark:border-amber-700 dark:bg-amber-950 dark:text-stone-100"
    >
      <p className="font-semibold">
        {reminder.neverBackedUp ? 'ยังไม่เคยสำรองข้อมูล' : 'ถึงเวลาสำรองข้อมูลแล้ว'}
      </p>
      <p className="mt-1 text-sm">
        {reminder.neverBackedUp
          ? `เริ่มบันทึกมา ${daysAgoText(reminder.daysSince ?? 0)}`
          : `สำรองล่าสุด ${daysAgoText(reminder.daysSince ?? 0)}`}
        {' — ข้อมูลอยู่ในเครื่องนี้เท่านั้น ถ้าเบราว์เซอร์ล้างข้อมูลหรือเปลี่ยนเครื่อง ข้อมูลจะหายถ้าไม่มีไฟล์สำรอง'}
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={onOpen}>สำรองเลย</Button>
        <Button
          variant="ghost"
          onClick={() => {
            snoozeReminder()
            setSnoozed(true)
          }}
        >
          ไว้ทีหลัง
        </Button>
      </div>
    </section>
  )
}
