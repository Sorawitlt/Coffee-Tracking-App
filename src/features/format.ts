/** จัดรูปแบบเงิน เช่น "฿27.00" — รหัสสกุลเงินที่ไม่รู้จักจะแสดงเป็น "27.00 XXX" แทนที่จะ error */
export function formatMoney(amount: number, currency = 'THB', locale = 'th-TH'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** กรัมแบบสั้น: ตัดทศนิยมที่ไม่จำเป็น (250 → "250", 12.5 → "12.5") */
export function formatGrams(g: number): string {
  return String(Math.round(g * 10) / 10)
}

/** ระยะเวลาเป็น "2:30" หรือ "12:00:00" (ตั้งแต่ 1 ชั่วโมงขึ้นไป) */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** วันเวลาแบบสั้นตาม locale เช่น "9 พ.ย. 08:30" (th-TH) / "9 Nov, 08:30" (en-GB) — แสดงปีเฉพาะเมื่อไม่ใช่ปีนี้ */
export function formatDateTime(iso: string, now: Date = new Date(), locale = 'th-TH'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
