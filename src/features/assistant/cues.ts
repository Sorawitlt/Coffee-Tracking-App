import type { CueKind } from '../../domain/brewPlan'
import type { AssistantPrefs } from './prefs'

/**
 * เสียง + สั่นแจ้งเตือนของผู้ช่วยชง
 *
 * - เสียงสร้างด้วย Web Audio (ไม่ต้องมีไฟล์เสียง ใช้ออฟไลน์ได้)
 * - เบราว์เซอร์ (โดยเฉพาะ iOS) บล็อกเสียงจนกว่าผู้ใช้จะแตะหน้าจอ → ต้องเรียก `unlock()` ในเหตุการณ์แตะ
 *   (ปุ่มเริ่มจับเวลา) ก่อน แล้วเสียงที่เล่นทีหลังจาก timer จึงจะดัง
 * - ทุกฟีเจอร์ตรวจว่าเครื่องรองรับก่อนใช้ ไม่รองรับ = เงียบ ๆ ไม่ error
 */

interface Beep {
  freq: number
  ms: number
}

/** รูปแบบเสียง: ลำดับเสียงบี๊บ (ความถี่ Hz, ความยาว ms) คั่นด้วยช่วงเงียบสั้น ๆ */
export const BEEP_PATTERNS: Record<CueKind, readonly Beep[]> = {
  tick: [{ freq: 880, ms: 70 }],
  step: [{ freq: 1046, ms: 140 }, { freq: 1318, ms: 200 }],
  target: [{ freq: 784, ms: 220 }, { freq: 784, ms: 220 }, { freq: 1046, ms: 420 }],
}

/** รูปแบบสั่น (ms สั่น/หยุดสลับกัน) */
export const VIBRATE_PATTERNS: Record<CueKind, readonly number[]> = {
  tick: [25],
  step: [180, 90, 180],
  target: [300, 120, 300, 120, 500],
}

const GAP_SEC = 0.06
const VOLUME = 0.35

export interface CuePlayer {
  /** เรียกในเหตุการณ์แตะ/คลิก เพื่อให้เบราว์เซอร์อนุญาตเสียง */
  unlock(): void
  play(kind: CueKind, prefs: Pick<AssistantPrefs, 'sound' | 'vibrate'>): void
}

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext
}

/** เครื่องนี้สั่นได้ไหม (iOS Safari ไม่รองรับ) */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function createCuePlayer(): CuePlayer {
  let ctx: AudioContext | undefined

  function unlock() {
    const Ctor = audioContextCtor()
    if (!Ctor) return
    try {
      ctx ??= new Ctor()
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    } catch {
      ctx = undefined
    }
  }

  function beep(pattern: readonly Beep[]) {
    if (!ctx || ctx.state === 'closed') return
    try {
      let t = ctx.currentTime
      for (const { freq, ms } of pattern) {
        const dur = ms / 1000
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        // ไล่ระดับเสียงเข้า-ออก กันเสียงแตกพรึ่บตอนเริ่ม/จบ
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(VOLUME, t + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + dur + 0.02)
        t += dur + GAP_SEC
      }
    } catch {
      // เล่นเสียงไม่ได้ก็ไม่ต้องทำอะไร — ตัวเลขบนจอยังบอกครบ
    }
  }

  return {
    unlock,
    play(kind, prefs) {
      if (prefs.sound) beep(BEEP_PATTERNS[kind])
      if (prefs.vibrate && canVibrate()) {
        try {
          navigator.vibrate([...VIBRATE_PATTERNS[kind]])
        } catch {
          // บางเบราว์เซอร์ปฏิเสธถ้ายังไม่มีการแตะหน้าจอ
        }
      }
    },
  }
}
