import { useEffect, useState } from 'react'
import { getBean, useLive } from '../../db'
import { BeanForm } from './BeanForm'
import { BeanList } from './BeanList'

/** หน้า "เมล็ด": สลับระหว่างรายการ ↔ ฟอร์ม (เต็มจอ เหมาะกับมือถือ) */
type View = { kind: 'list' } | { kind: 'form'; id?: string }

export function BeansSection() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const toList = () => setView({ kind: 'list' })

  if (view.kind === 'list') {
    return <BeanList onAdd={() => setView({ kind: 'form' })} onOpen={(id) => setView({ kind: 'form', id })} />
  }
  return view.id ? <EditBean id={view.id} onDone={toList} /> : <BeanForm onDone={toList} />
}

function EditBean({ id, onDone }: { id: string; onDone: () => void }) {
  // `null` = ไม่พบเมล็ด (เช่น ถูกลบไปแล้ว), `undefined` = กำลังโหลด
  const bean = useLive(() => getBean(id).then((b) => b ?? null), [id])

  useEffect(() => {
    if (bean === null) onDone()
  }, [bean, onDone])

  if (!bean) return null
  // key = id เพื่อให้ฟอร์มอ่านค่าเริ่มต้นครั้งเดียว ไม่ถูกทับระหว่างที่ผู้ใช้กำลังพิมพ์
  return <BeanForm key={bean.id} bean={bean} onDone={onDone} />
}
