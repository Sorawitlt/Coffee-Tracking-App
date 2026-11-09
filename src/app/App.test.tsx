import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('แสดงแท็บหลัก 4 แท็บ และสลับได้', async () => {
    render(<App />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: /เมล็ด/ }))
    expect(screen.getByRole('button', { name: /เมล็ด/ })).toHaveAttribute('aria-current', 'page')
  })
})
