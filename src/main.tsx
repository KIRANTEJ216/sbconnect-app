import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { startWebVitals } from './lib/webVitals.ts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

// Deferred until after paint so measurement never competes with first render.
if (import.meta.env.PROD || import.meta.env.VITE_WEB_VITALS_DEBUG === 'true') {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => startWebVitals())
  } else {
    setTimeout(startWebVitals, 2000)
  }
}