import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  // โหมดมืด: พื้นอำพันสว่าง + ตัวอักษรเข้ม (ขาวบนอำพันกลางได้คอนทราสต์แค่ ~3:1 ไม่ผ่าน WCAG AA)
  primary: 'bg-amber-800 text-white hover:bg-amber-900 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400',
  secondary:
    'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghost: 'text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-stone-800',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/** ปุ่มมาตรฐาน — สูงอย่างน้อย 48px เพื่อกดมือเดียวได้ (PLAN ข้อ 4) */
export function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
