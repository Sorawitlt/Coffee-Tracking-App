import { useEffect, useState } from 'react'
import { getGear, useLive } from '../../db'
import { GearForm } from './GearForm'
import { GearList } from './GearList'

type View = { kind: 'list' } | { kind: 'form'; id?: string }

export function GearSection() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const toList = () => setView({ kind: 'list' })

  if (view.kind === 'list') {
    return <GearList onAdd={() => setView({ kind: 'form' })} onOpen={(id) => setView({ kind: 'form', id })} />
  }
  return view.id ? <EditGear id={view.id} onDone={toList} /> : <GearForm onDone={toList} />
}

function EditGear({ id, onDone }: { id: string; onDone: () => void }) {
  const gear = useLive(() => getGear(id).then((g) => g ?? null), [id])

  useEffect(() => {
    if (gear === null) onDone()
  }, [gear, onDone])

  if (!gear) return null
  return <GearForm key={gear.id} gear={gear} onDone={onDone} />
}
