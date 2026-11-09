import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyTheme, DARK_QUERY, isTheme, nextTheme, resolveTheme, THEME_CACHE_KEY, THEME_COLOR, THEMES } from './theme'

describe('resolveTheme', () => {
  it('อัตโนมัติ = ตามเครื่อง, เลือกเอง = ตามที่เลือก (ไม่สนเครื่อง)', () => {
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('nextTheme — กดวนครบ 3 ค่า และกดครั้งแรกเห็นการเปลี่ยนทันที', () => {
  it.each([false, true])('เครื่องตั้งโหมดมืด = %s', (systemDark) => {
    let theme = nextTheme('system', systemDark)
    expect(resolveTheme(theme, systemDark)).not.toBe(resolveTheme('system', systemDark))
    const seen = new Set(['system', theme])
    theme = nextTheme(theme, systemDark)
    seen.add(theme)
    expect(nextTheme(theme, systemDark)).toBe('system')
    expect(seen).toEqual(new Set(THEMES))
  })
})

it('isTheme รับเฉพาะค่าที่รู้จัก', () => {
  expect(THEMES.every(isTheme)).toBe(true)
  expect(isTheme('sepia')).toBe(false)
  expect(isTheme(null)).toBe(false)
})

describe('applyTheme', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="">'
    document.documentElement.className = ''
  })

  it('ใส่/ถอด class dark, color-scheme และสีแถบเบราว์เซอร์', () => {
    applyTheme('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLOR.dark)

    applyTheme('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLOR.light)
  })
})

it('สคริปต์กันจอกะพริบใน index.html ใช้คีย์ คิวรี และสีเดียวกับ theme.ts', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''
  expect(script).toContain(`'${THEME_CACHE_KEY}'`)
  expect(script).toContain(`'${DARK_QUERY}'`)
  expect(script).toContain(`'${THEME_COLOR.dark}'`)
  expect(script).toContain(`'${THEME_COLOR.light}'`)
  // สีเริ่มต้นใน <meta> (ก่อนสคริปต์รัน) = สีโหมดสว่าง
  expect(html).toContain(`<meta name="theme-color" content="${THEME_COLOR.light}" />`)
})
