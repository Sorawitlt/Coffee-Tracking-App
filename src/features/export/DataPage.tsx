import { useEffect, useState, type ReactNode } from 'react'
import {
  createBackup, getSettings, isStoragePersistent, markBackedUp, readTables, requestPersistentStorage, useLive,
} from '../../db'
import { backupCounts } from '../../domain/backup'
import { beansToCsv, brewsToCsv } from '../../domain/export'
import { Button } from '../../components/Button'
import { formatDateTime } from '../format'
import { countsText, daysAgoText } from './backupText'
import { downloadTextFile, exportFileName, MIME_CSV, MIME_JSON, type ExportKind } from './files'
import { RestoreSection } from './RestoreSection'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

type Notice = { kind: 'ok' | 'error'; text: string }

/** หน้า "ข้อมูลของฉัน": สำรอง/นำกลับ (JSON) · ส่งออก CSV · สถานะที่เก็บข้อมูลในเครื่อง */
export default function DataPage({ onClose }: { onClose: () => void }) {
  const settings = useLive(getSettings)
  const [notice, setNotice] = useState<Notice>()
  const [busy, setBusy] = useState(false)
  const [persistent, setPersistent] = useState<boolean>()

  useEffect(() => {
    void isStoragePersistent().then(setPersistent)
  }, [])

  async function run(job: () => Promise<string>) {
    setBusy(true)
    setNotice(undefined)
    try {
      setNotice({ kind: 'ok', text: await job() })
    } catch (err) {
      console.error('export failed', err)
      setNotice({ kind: 'error', text: 'สร้างไฟล์ไม่สำเร็จ กรุณาลองใหม่' })
    } finally {
      setBusy(false)
    }
  }

  const backup = () =>
    run(async () => {
      const file = await createBackup()
      const name = exportFileName('backup')
      downloadTextFile(name, JSON.stringify(file), MIME_JSON)
      await markBackedUp(file.exportedAt)
      return `สร้างไฟล์ ${name} แล้ว (${countsText(backupCounts(file.data))}) — เก็บไว้ในที่ปลอดภัย เช่น Google Drive / OneDrive`
    })

  const exportCsv = (kind: Exclude<ExportKind, 'backup'>) =>
    run(async () => {
      const { beans, gear, brews } = await readTables()
      const csv = kind === 'brews' ? brewsToCsv(brews, beans, gear) : beansToCsv(beans)
      const name = exportFileName(kind)
      downloadTextFile(name, csv, MIME_CSV)
      return `สร้างไฟล์ ${name} แล้ว (${kind === 'brews' ? brews.length : beans.length} แถว) — เปิดได้ใน Excel และ Google Sheets`
    })

  const last = settings?.lastBackupAt

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onClose} aria-label="กลับ">← กลับ</Button>
        <h2 className="text-xl font-bold">ข้อมูลของฉัน</h2>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-xl p-3 text-sm font-medium ${
            notice.kind === 'error'
              ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
              : 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200'
          }`}
        >
          {notice.text}
        </p>
      )}

      <Card title="สำรองข้อมูล (JSON)">
        <p className="text-sm text-stone-600 dark:text-stone-400">
          ไฟล์เดียวเก็บทุกอย่าง: เมล็ด อุปกรณ์ สูตรของฉัน บันทึกการชง และการตั้งค่า — ใช้นำกลับมาเมื่อเปลี่ยนเครื่องหรือข้อมูลหาย
        </p>
        <p className="text-sm" data-testid="last-backup">
          สำรองล่าสุด:{' '}
          <strong>
            {settings === undefined
              ? '…'
              : last
                ? `${formatDateTime(last)} (${daysAgoText(Math.floor((Date.now() - Date.parse(last)) / 86_400_000))})`
                : 'ยังไม่เคย'}
          </strong>
        </p>
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => void backup()}>
          ⬇️ ดาวน์โหลดไฟล์สำรอง
        </Button>
      </Card>

      <Card title="นำข้อมูลกลับ (Restore)">
        <RestoreSection />
      </Card>

      <Card title="ส่งออก CSV (Excel / Google Sheets)">
        <p className="text-sm text-stone-600 dark:text-stone-400">
          สำหรับวิเคราะห์เอง ไม่ใช่ไฟล์สำรอง · เปิดใน Excel ภาษาไทยได้ไม่เพี้ยน · ใน Google Sheets ใช้ ไฟล์ → นำเข้า
          · หัวคอลัมน์เป็นภาษาอังกฤษและระบุหน่วย เช่น <code>dose_g</code>, <code>temp_c</code>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={busy} onClick={() => void exportCsv('brews')}>📖 บันทึกการชง (.csv)</Button>
          <Button disabled={busy} onClick={() => void exportCsv('beans')}>🫘 คลังเมล็ด (.csv)</Button>
        </div>
      </Card>

      <Card title="ที่เก็บข้อมูลในเครื่องนี้">
        <p className="text-sm" data-testid="persist-status">
          สถานะ:{' '}
          <strong>
            {persistent === undefined ? '…' : persistent ? 'เก็บถาวร (เบราว์เซอร์ไม่ลบเอง)' : 'ไม่รับประกัน'}
          </strong>
        </p>
        {persistent === false && (
          <>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              เบราว์เซอร์อาจลบข้อมูลเมื่อพื้นที่เต็มหรือไม่ได้เปิดแอปนาน (โดยเฉพาะ Safari บน iPhone/iPad ที่ไม่ได้ติดตั้งแอป)
              — แนะนำให้ติดตั้งลงหน้าจอโฮม (Add to Home Screen) และสำรองข้อมูลสม่ำเสมอ
            </p>
            <Button onClick={() => void requestPersistentStorage().then(setPersistent)}>ขอเก็บข้อมูลถาวร</Button>
          </>
        )}
      </Card>
    </div>
  )
}
