import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileStack, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { DocumentStatusBadge } from '../components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { Pagination } from '../components/Pagination'
import { apiErrorMessage, listDocuments, uploadDocument } from '../lib/api'
import { POLL_INTERVAL_MS } from '../lib/queryClient'
import { useToast } from '../context/ToastContext'
import { formatDate } from '../lib/format'

const PAGE_SIZE = 15

export function Documents() {
  const [page, setPage] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { push } = useToast()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['documents', page],
    queryFn: () => listDocuments(page, PAGE_SIZE),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      return items.some((d) => d.status === 'processing') ? POLL_INTERVAL_MS : false
    },
  })

  const uploadMutation = useMutation({
    mutationFn: uploadDocument,
    onSuccess: (doc) => {
      push('success', `${doc.filename} uploaded — processing started.`)
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => {
      push('error', apiErrorMessage(err, 'Upload failed.'))
    },
  })

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    Array.from(files).forEach((file) => uploadMutation.mutate(file))
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ingestion"
        title="Documents"
        description="Upload contracts, invoices, and policies for OCR, chunking, and indexing."
      />

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-6 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]'
        }`}
      >
        <Upload className="h-6 w-6 text-[var(--color-text-faint)]" />
        <p className="text-sm text-[var(--color-text)]">
          Drag and drop files here, or{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-[var(--color-text-faint)]">PDF or image — scanned pages are OCR'd automatically</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {uploadMutation.isPending && (
          <p className="font-mono text-xs text-[var(--color-primary)]">Uploading…</p>
        )}
      </div>

      <Card className="p-0">
        {isLoading ? (
          <LoadingState label="Loading documents…" />
        ) : isError ? (
          <div className="p-6">
            <ErrorState message={apiErrorMessage(error, 'Could not load documents.')} retry={() => refetch()} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileStack className="h-7 w-7" />}
              title="No documents yet"
              description="Upload a PDF or scanned image above to start building your searchable corpus."
            />
          </div>
        ) : (
          <div className="p-2">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
                  <th className="px-4 py-2 font-medium">Filename</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Pages</th>
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="px-4 py-2 font-medium">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((doc) => (
                  <tr key={doc.id} className="border-t border-[var(--color-border-soft)]">
                    <td className="px-4 py-3">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline"
                      >
                        {doc.filename}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <DocumentStatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--color-text-muted)]">
                      {doc.page_count ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--color-text-muted)]">v{doc.version}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDate(doc.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-2 pb-1 pt-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
