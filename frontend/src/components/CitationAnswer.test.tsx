import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CitationAnswer } from './CitationAnswer'
import type { Citation } from '../types'

const citations: Citation[] = [
  { chunk_id: 101, document_id: 42, page_number: 3, snippet: 'Termination requires 30 days notice.' },
]

describe('CitationAnswer', () => {
  it('renders inline citation markers as clickable buttons', () => {
    render(<CitationAnswer answer="Notice is 30 days [1]." citations={citations} />)
    expect(screen.getByTestId('citation-marker-1')).toBeInTheDocument()
  })

  it('lists referenced sources with their document and page', () => {
    render(<CitationAnswer answer="Notice is 30 days [1]." citations={citations} />)
    expect(screen.getByText(/Document #42/)).toBeInTheDocument()
    expect(screen.getByText(/page 3/)).toBeInTheDocument()
  })

  it('calls onOpenDocument with the document and page when a source is clicked', () => {
    const onOpenDocument = vi.fn()
    render(<CitationAnswer answer="Notice is 30 days [1]." citations={citations} onOpenDocument={onOpenDocument} />)

    fireEvent.click(screen.getByText(/Document #42/))

    expect(onOpenDocument).toHaveBeenCalledWith(42, 3)
  })

  it('does not render a sources list when the answer has no citation markers', () => {
    render(<CitationAnswer answer="A plain answer with no sources." citations={citations} />)
    expect(screen.queryByText('Sources')).not.toBeInTheDocument()
  })
})
