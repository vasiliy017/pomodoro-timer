import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Panel } from './Panel'

describe('Panel', () => {
  it('renders its children inside a styled section', () => {
    render(<Panel>hello</Panel>)
    const panel = screen.getByText('hello')
    expect(panel.tagName).toBe('SECTION')
    expect(panel).toHaveClass('panel')
  })
})
