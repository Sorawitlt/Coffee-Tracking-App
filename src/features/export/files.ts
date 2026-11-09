/** ช่วยเหลือเรื่องไฟล์ในเบราว์เซอร์: ตั้งชื่อ, ดาวน์โหลด, อ่านไฟล์ที่ผู้ใช้เลือก */

export type ExportKind = 'backup' | 'brews' | 'beans'

/** ชื่อไฟล์ตามวันที่ท้องถิ่น เช่น `brew-log-backup-2026-11-09.json` */
export function exportFileName(kind: ExportKind, now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `brew-log-${kind}-${y}-${m}-${d}.${kind === 'backup' ? 'json' : 'csv'}`
}

export const MIME_JSON = 'application/json'
export const MIME_CSV = 'text/csv;charset=utf-8'

/** สั่งให้เบราว์เซอร์ดาวน์โหลดไฟล์ข้อความ (ทำงานได้ออฟไลน์ ไม่ผ่านเซิร์ฟเวอร์) */
export function downloadTextFile(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // เว้นเวลาให้เบราว์เซอร์เริ่มดาวน์โหลดก่อนปล่อยหน่วยความจำ
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** ไฟล์สำรองที่ใหญ่กว่านี้ไม่ใช่ไฟล์ของแอปนี้แน่ ๆ — ไม่อ่านเข้าหน่วยความจำ */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024

export function readFileText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
