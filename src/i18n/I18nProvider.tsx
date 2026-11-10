import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { getSettings, updateSettings, useLive } from '../db'
import { useSyncedChoice } from '../db/useSyncedChoice'
import type { Language } from '../domain/types'
import { createT, DEFAULT_LANGUAGE, isLanguage, LOCALE, type TFunction } from './index'

/**
 * ภาษาที่เลือกเก็บใน Settings (IndexedDB) เป็นหลัก และสำเนาใน localStorage
 * เพื่อให้เปิดแอปครั้งถัดไปแสดงภาษาถูกตั้งแต่เฟรมแรก (ไม่กะพริบเป็นภาษาไทยก่อน)
 */
export const LANGUAGE_CACHE_KEY = 'brewlog.language'

function readCachedLanguage(): Language {
  try {
    const v = localStorage.getItem(LANGUAGE_CACHE_KEY)
    return isLanguage(v) ? v : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function cacheLanguage(lang: Language) {
  try {
    localStorage.setItem(LANGUAGE_CACHE_KEY, lang)
  } catch {
    /* โหมดส่วนตัว/ปิดที่เก็บข้อมูล: ข้ามได้ — ค่าหลักอยู่ใน IndexedDB */
  }
}

export interface I18nValue {
  lang: Language
  /** locale สำหรับ Intl เช่น "th-TH" */
  locale: string
  t: TFunction
  setLanguage: (lang: Language) => void
}

function makeValue(lang: Language, setLanguage: (l: Language) => void): I18nValue {
  return { lang, locale: LOCALE[lang], t: createT(lang), setLanguage }
}

// ค่าเริ่มต้นเมื่อไม่มี Provider (เช่น เทสต์คอมโพเนนต์เดี่ยว ๆ) = ภาษาไทย
const I18nContext = createContext<I18nValue>(makeValue(DEFAULT_LANGUAGE, () => {}))

export function I18nProvider({ children }: { children: ReactNode }) {
  const savedLanguage = useLive(async () => (await getSettings()).language)
  // ตาม DB (เช่น นำข้อมูลสำรองกลับ) แต่ค่าเก่าที่อ่านค้างมาไม่ทับค่าที่ผู้ใช้เพิ่งเลือก — ดู useSyncedChoice
  const [lang, setLanguage] = useSyncedChoice(savedLanguage, readCachedLanguage, cacheLanguage, saveLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => makeValue(lang, setLanguage), [lang, setLanguage])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

const saveLanguage = (language: Language) => updateSettings({ language })

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

/** ทางลัดสำหรับคอมโพเนนต์ที่ใช้แค่ฟังก์ชันแปล */
export function useT(): TFunction {
  return useContext(I18nContext).t
}
