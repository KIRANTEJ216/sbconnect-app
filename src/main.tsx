import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function reportWebVitals(metric: { name: string; value: number; rating: string }) {
  if (import.meta.env.PROD) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value} (${metric.rating})`);
  }
}

onCLS(reportWebVitals);
onFCP(reportWebVitals);
onINP(reportWebVitals);
onLCP(reportWebVitals);
onTTFB(reportWebVitals);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
