import Dexie from 'dexie'

// โครง Dexie เปล่า — schema จริง (beans, gear, recipes, brews, settings) เพิ่มในขั้น 2
export const db = new Dexie('brew-log')
db.version(1).stores({})
