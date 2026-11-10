import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

/**
 * ค่าตั้งที่ผู้ใช้เลือกเอง (ธีม, ภาษา) ที่เก็บ 3 ที่: state บนจอ · IndexedDB (`Settings`) · สำเนา localStorage
 *
 * ลำดับความสำคัญ: ค่าที่ผู้ใช้เพิ่งเลือก (รอ DB ยืนยัน) → ค่าจาก DB → ค่าจาก localStorage (ตอนเปิดแอป ก่อน DB อ่านเสร็จ)
 *
 * กันการแข่งกัน (race) 2 แบบ
 * 1. ผู้ใช้กดเลือก "ก่อน" ที่การอ่าน DB ที่เริ่มไปแล้วจะกลับมา → ค่าเก่าที่อ่านค้างมาต้องไม่ทับค่าที่เลือก
 *    จึงถือค่าที่เลือกไว้จนกว่า **บันทึกครบทุกครั้ง และ** DB ส่งค่าที่ตรงกันกลับมา แล้วค่อยกลับไปตาม DB
 *    (ห้ามเลิกถือตอนยังบันทึกไม่เสร็จ: กด มืด→สว่าง→อัตโนมัติ เร็ว ๆ ค่า "อัตโนมัติ" เดิมใน DB บังเอิญตรงกับค่าที่เลือก
 *    แต่ DB จะส่ง มืด / สว่าง ที่กำลังบันทึกตามมา → จอกระพริบกลับ)
 * 2. React อาจรัน effect ของรอบก่อน "หลัง" ที่ผู้ใช้กดครั้งใหม่ → effect อ่านค่าล่าสุดจาก ref เสมอ
 *    ไม่ใช้ค่าที่ค้างใน closure (ไม่งั้น effect ที่มาช้าจะลบค่าที่เพิ่งเลือก หรือเขียนค่าเก่าลง localStorage)
 *
 * ยังตามการเปลี่ยนจากที่อื่นได้ตามปกติ (เช่น นำข้อมูลสำรองกลับ) เมื่อไม่มีค่าที่รอยืนยัน
 *
 * @param saved ค่าจาก DB แบบสด (`undefined` = ยังอ่านไม่เสร็จ)
 * @param initial ค่าตอนเปิดแอปก่อน DB อ่านเสร็จ (อ่านครั้งเดียว)
 * @param cache เขียนสำเนาลง localStorage (ให้เปิดครั้งหน้าแสดงถูกตั้งแต่เฟรมแรก)
 * @param save บันทึกลง DB
 */
export function useSyncedChoice<T extends string>(
  saved: T | undefined,
  initial: () => T,
  cache: (value: T) => void,
  save: (value: T) => Promise<unknown>,
): [T, (value: T) => void] {
  const [fallback] = useState(initial)
  /** ค่าที่ผู้ใช้เลือกแต่ DB ยังไม่ยืนยัน (ref = ค่าล่าสุดเสมอ แม้ effect จะรันช้า) */
  const pending = useRef<T | undefined>(undefined)
  /** จำนวนการบันทึกที่ยังไม่เสร็จ */
  const saving = useRef(0)
  /** เปลี่ยนเมื่อ pending/saving เปลี่ยน → render ใหม่ และให้ effect ด้านล่างตรวจอีกรอบ */
  const [version, bump] = useReducer((n: number) => n + 1, 0)

  // ฟังก์ชันจากผู้เรียกอาจเปลี่ยนตัวทุกรอบ render — เก็บตัวล่าสุดไว้ ไม่ให้ setChoice เปลี่ยนตัวตาม
  const io = useRef({ cache, save })
  io.current = { cache, save }

  useEffect(() => {
    if (pending.current === undefined) {
      // ตาม DB: ค่าเริ่มต้นตอนเปิดแอป และการเปลี่ยนจากที่อื่น
      if (saved !== undefined) io.current.cache(saved)
    } else if (saving.current === 0 && saved === pending.current) {
      // บันทึกครบแล้วและ DB ยืนยันค่าที่เลือก → เลิกถือค่า กลับไปตาม DB
      pending.current = undefined
      bump()
    }
  }, [saved, version])

  const setChoice = useCallback((next: T) => {
    pending.current = next
    saving.current += 1
    io.current.cache(next)
    bump()
    io.current
      .save(next)
      // บันทึกไม่สำเร็จ: คงค่าที่เลือกไว้ในเซสชันนี้ (เหมือนพฤติกรรมเดิม) แต่แจ้งใน console
      .catch((err) => console.error('save setting failed', err))
      .finally(() => {
        saving.current -= 1
        bump()
      })
  }, [])

  return [pending.current ?? saved ?? fallback, setChoice]
}
