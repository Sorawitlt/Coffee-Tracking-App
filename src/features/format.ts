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
