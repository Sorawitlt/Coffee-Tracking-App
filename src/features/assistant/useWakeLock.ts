import { useEffect, useState } from 'react'

/**
 * กันหน้าจอดับระหว่างชง (Screen Wake Lock API)
 *
 * - `unsupported`: เบราว์เซอร์ไม่รองรับ → UI แจ้งผู้ใช้ให้ปิดล็อกหน้าจออัตโนมัติเอง
 * - `off`       : ไม่ได้ขอ (ไม่ได้เปิดใช้) หรือถูกระบบปล่อยแล้วและกำลังขอใหม่
 * - `active`    : หน้าจอจะไม่ดับ
 * - `failed`    : ขอไม่ได้ (เช่น โหมดประหยัดแบตเตอรี่)
 *
 * เบราว์เซอร์ปล่อย lock เองทุกครั้งที่หน้าถูกซ่อน (สลับแอป/ล็อกจอ) → ขอใหม่ทุกครั้งที่หน้ากลับมามองเห็น
 */
export type WakeLockStatus = 'unsupported' | 'off' | 'active' | 'failed'

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator && !!navigator.wakeLock
}

export function useWakeLock(enabled: boolean): WakeLockStatus {
  const supported = isWakeLockSupported()
  const [status, setStatus] = useState<WakeLockStatus>(supported ? 'off' : 'unsupported')

  useEffect(() => {
    if (!enabled || !supported) {
      setStatus(supported ? 'off' : 'unsupported')
      return
    }

    let cancelled = false
    let sentinel: WakeLockSentinel | undefined

    async function acquire() {
      if (cancelled || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          // ถูกยกเลิกระหว่างรอ (ปิดหน้า/หยุดชง) → ปล่อยทันที ไม่ค้าง
          void lock.release().catch(() => undefined)
          return
        }
        sentinel = lock
        lock.addEventListener('release', () => {
          if (!cancelled) setStatus('off')
        })
        setStatus('active')
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVisibility)
    void acquire()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => undefined)
    }
  }, [enabled, supported])

  return status
}
