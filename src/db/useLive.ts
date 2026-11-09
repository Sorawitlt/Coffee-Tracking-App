import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

/**
 * อ่านข้อมูลจาก IndexedDB แบบ "สด" — หน้าจอรีเฟรชเองเมื่อข้อมูลที่เกี่ยวข้องเปลี่ยน
 * คืน `undefined` ระหว่างโหลดครั้งแรก
 *
 * `deps` คือค่าที่ `query` ใช้ (เช่น ตัวกรอง) — เปลี่ยนแล้วจะ query ใหม่
 */
export function useLive<T>(query: () => Promise<T> | T, deps: readonly unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>()

  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: setValue,
      error: (err) => console.error('liveQuery failed', err),
    })
    return () => sub.unsubscribe()
  }, deps)

  return value
}
