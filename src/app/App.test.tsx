import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('แสดงแท็บหลัก 4 แท็บ และสลับได้', async () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' })
    expect(within(nav).getAllByRole('button')).toHaveLength(4)
    await userEvent.click(within(nav).getByRole('button', { name: /เมล็ด/ }))
    expect(within(nav).getByRole('button', { name: /เมล็ด/ })).toHaveAttribute('aria-current', 'page')
  })

  it('แท็บเมล็ดแสดงคลังเมล็ดและอุปกรณ์', async () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' })
    await userEvent.click(within(nav).getByRole('button', { name: /เมล็ด/ }))
    expect(await screen.findByRole('button', { name: '+ เพิ่มเมล็ด' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /อุปกรณ์/ })).toBeInTheDocument()
  })
})
