import { db } from './db'

describe('db', () => {
  it('เปิดฐานข้อมูล IndexedDB (Dexie) ได้', async () => {
    await db.open()
    expect(db.isOpen()).toBe(true)
    expect(db.name).toBe('brew-log')
  })
})
