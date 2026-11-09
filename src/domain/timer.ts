/**
 * ตัวจับเวลาชง (Stopwatch) — Pure functions ไม่มี UI / ไม่มี setInterval
 *
 * หลักการ: **ไม่นับ tick** แต่เก็บ "เวลานาฬิกา" แล้วคำนวณเวลาที่ผ่านไปทุกครั้งที่อ่าน
 * → เวลาไม่คลาดเมื่อเบราว์เซอร์หน่วง timer ตอนจอดับ/สลับแอป และเก็บลง storage กู้คืนหลังเปิดแอปใหม่ได้
 *
 * สถานะ:  ready ──start──▶ running ◀──pause/resume──▶ paused ──finish──▶ finished
 *                                                                          │ reopen
 *                                                                          ▼ (กลับไป paused)
 * ค่าเวลาทั้งหมดเป็น "มิลลิวินาที" และ `now` คือ `Date.now()` ที่ผู้เรียกส่งเข้ามา (ทดสอบง่าย)
 */

export type TimerState =
  | { status: 'ready' }
  /** เวลาที่ผ่านไป = offsetMs + (now − startedAtMs) */
  | { status: 'running'; startedAtMs: number; offsetMs: number }
  | { status: 'paused'; elapsedMs: number }
  | { status: 'finished'; elapsedMs: number }

export const READY: TimerState = { status: 'ready' }

/** เวลาที่ผ่านไป (ms) — ไม่ติดลบ และไม่ถอยหลังแม้นาฬิกาเครื่องถูกปรับย้อน */
export function elapsedMs(timer: TimerState, now: number): number {
  switch (timer.status) {
    case 'ready':
      return 0
    case 'running':
      return Math.max(timer.offsetMs, timer.offsetMs + (now - timer.startedAtMs))
    default:
      return timer.elapsedMs
  }
}

/** เริ่มจับเวลา (เฉพาะตอน ready) */
export function startTimer(timer: TimerState, now: number): TimerState {
  return timer.status === 'ready' ? { status: 'running', startedAtMs: now, offsetMs: 0 } : timer
}

export function pauseTimer(timer: TimerState, now: number): TimerState {
  return timer.status === 'running' ? { status: 'paused', elapsedMs: elapsedMs(timer, now) } : timer
}

export function resumeTimer(timer: TimerState, now: number): TimerState {
  return timer.status === 'paused' ? { status: 'running', startedAtMs: now, offsetMs: timer.elapsedMs } : timer
}

/** จบการชง — ต้องเริ่มแล้วเท่านั้น (ready → ไม่มีผล) */
export function finishTimer(timer: TimerState, now: number): TimerState {
  if (timer.status === 'running' || timer.status === 'paused') {
    return { status: 'finished', elapsedMs: elapsedMs(timer, now) }
  }
  return timer
}

/** กดจบพลาด → กลับไปจับเวลาต่อ (เริ่มต่อจากเวลาตอนกดจบ, เวลาที่ผ่านไประหว่างนั้นไม่นับ) */
export function reopenTimer(timer: TimerState): TimerState {
  return timer.status === 'finished' ? { status: 'paused', elapsedMs: timer.elapsedMs } : timer
}

/** กำลังเดินอยู่ / หยุดพักอยู่ — คือช่วงที่หน้าจับเวลาแสดง */
export const isActive = (timer: TimerState): boolean => timer.status === 'running' || timer.status === 'paused'
