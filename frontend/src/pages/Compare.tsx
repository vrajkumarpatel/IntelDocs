import { useMutation, useQuery } from '@tanstack/react-query'
import { SplitSquareHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../components/Card'
import { DocumentPicker } from '../components/DocumentPicker'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { apiErrorMessage, compareDocuments, listDocuments } from '../lib/api'

export function Compare() {
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState<number[]>([])

  const { data: docsPage, isLoading: docsLoading } = useQuery({
    queryKey: ['documents', 'for-compare-page'],
    queryFn: () => listDocuments(1, 100),
  })

  useEffect(() => {
    const preselect = searchParams.getAll('doc').map(Number).filter(Number.isFinite)
    if (preselect.length > 0) setSelected(preselect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mutation = useMutation({
    mutationFn: compareDocuments,
  })

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const documents = docsPage?.items ?? []
  const canCompare = selected.length >= 2

  return (
    <div>
      <PageHeader
        eyebrow="Structured diff"
        title="Compare"
        description="Pick two or more documents to see a structured comparison of their key aspects."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Documents ({selected.length} selected)</p>
          {docsLoading ? (
            <LoadingState label="Loading documents…" />
          ) : (
            <DocumentPicker documents={documents} selected={selected} onToggle={toggle} />
          )}
          <button
            type="button"
            disabled={!canCompare || mutation.isPending}
            onClick={() => mutation.mutate({ document_ids: selected })}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
          >
            <SplitSquareHorizontal className="h-3.5 w-3.5" />
            {mutation.isPending ? 'Comparing…' : 'Compare'}
          </button>
          {!canCompare && (
            <p className="mt-2 text-xs text-[var(--color-text-faint)]">Select at least two documents.</p>
          )}
        </Card>

        <div className="lg:col-span-2">
          {mutation.isPending && <LoadingState label="Generating structured comparison…" />}

          {mutation.isError && (
            <ErrorState message={apiErrorMessage(mutation.error, 'Could not generate a comparison.')} retry={() => mutation.mutate({ document_ids: selected })} />
          )}

          {mutation.data && (
            <Card className="p-5">
              <p className="mb-4 text-sm leading-relaxed text-[var(--color-text)]">{mutation.data.comparison_text}</p>

              {mutation.data.differences.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[var(--color-paper)] text-left text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
                        <th className="px-4 py-2 font-medium">Aspect</th>
                        <th className="px-4 py-2 font-medium">Document A</th>
                        <th className="px-4 py-2 font-medium">Document B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mutation.data.differences.map((diff, i) => (
                        <tr key={i} className="border-t border-[var(--color-border-soft)]">
                          <td className="px-4 py-3 font-medium text-[var(--color-text)]">{diff.aspect}</td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">{diff.doc_a_value}</td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">{diff.doc_b_value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {!mutation.data && !mutation.isPending && !mutation.isError && (
            <EmptyState
              icon={<SplitSquareHorizontal className="h-7 w-7" />}
              title="No comparison yet"
              description="Select documents on the left and run a comparison to see their differences side by side."
            />
          )}
        </div>
      </div>
    </div>
  )
}
