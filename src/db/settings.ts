import type { Settings } from '../domain/types'
import { db } from './db'

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  language: 'th',
  units: 'metric',
  theme: 'system',
  defaultMethod: 'v60',
}

/** อ่านการตั้งค่า — ถ้ายังไม่มีหรือขาดบางฟิลด์ (เวอร์ชันเก่า) จะเติมค่าเริ่มต้นให้ */
export async function getSettings(): Promise<Settings> {
  const saved = await db.settings.get('app')
  return { ...DEFAULT_SETTINGS, ...saved, id: 'app' }
}

export async function updateSettings(changes: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next: Settings = { ...(await getSettings()), ...changes, id: 'app' }
    await db.settings.put(next)
    return next
  })
}
