import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
})

/** Poll interval while a document is still processing or an eval run is
 *  still running. Stops automatically once TanStack Query sees a terminal
 *  status (the query functions return `refetchInterval: false` in that case). */
export const POLL_INTERVAL_MS = 3000
