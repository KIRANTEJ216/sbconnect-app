# Enterprise Mobile Performance & Responsive Design Guide

**Stack:** Next.js + Vercel + Firebase

## Goals

-   Fast loading on all devices
-   Responsive UI from 320px phones to 4K displays
-   Accessible, touch-friendly UX
-   Excellent Core Web Vitals

------------------------------------------------------------------------

# 1. Mobile-First Design

Design for mobile first, then progressively enhance for tablets and
desktops.

``` css
.container{
  padding:16px;
  font-size:1rem;
}

@media (min-width:768px){
  .container{padding:24px;}
}

@media (min-width:1024px){
  .container{padding:32px;}
}
```

------------------------------------------------------------------------

# 2. Responsive Typography

``` css
h1{font-size:clamp(2rem,5vw,3.5rem);}
h2{font-size:clamp(1.5rem,4vw,2.5rem);}
p{font-size:clamp(.95rem,2vw,1.1rem);}
```

Use `rem`, `em`, `%`, `vw`, `vh` instead of fixed pixels.

------------------------------------------------------------------------

# 3. Tailwind Responsive Classes

``` html
<div class="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl">
```

------------------------------------------------------------------------

# 4. Responsive Layout

``` css
grid-template-columns:repeat(auto-fit,minmax(300px,1fr));
```

Tailwind:

``` html
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
```

------------------------------------------------------------------------

# 5. Images

Use `next/image` for: - Automatic optimization - Lazy loading - WebP /
AVIF - Responsive sizing

------------------------------------------------------------------------

# 6. Lazy Loading

Use dynamic imports for heavy dashboards, maps and charts.

------------------------------------------------------------------------

# 7. Navigation

Desktop: - Logo - Navigation - Login

Mobile: - Logo - Hamburger menu - Slide-out drawer

------------------------------------------------------------------------

# 8. Touch Targets

Minimum: - Apple: 44×44 px - Google: 48×48 dp

------------------------------------------------------------------------

# 9. Device Breakpoints

  Device                 Width
  ------------- --------------
  Small Phone          \<480px
  Phone             480--767px
  Tablet           768--1023px
  Laptop          1024--1439px
  Desktop              ≥1440px

------------------------------------------------------------------------

# 10. Bundle Optimization

-   Tree shaking
-   Dynamic imports
-   Code splitting
-   Remove unused dependencies

------------------------------------------------------------------------

# 11. React Performance

-   React.memo
-   useMemo
-   useCallback
-   Virtualized lists (react-window / TanStack Virtual)

------------------------------------------------------------------------

# 12. Fonts

Use: - next/font - Variable fonts - WOFF2

------------------------------------------------------------------------

# 13. Prevent Layout Shift

Always specify image width/height and reserve layout space.

------------------------------------------------------------------------

# 14. Skeleton Loading

Show placeholders while data loads to improve perceived performance.

------------------------------------------------------------------------

# 15. Progressive Rendering

Load order: 1. Navigation 2. Hero 3. Main content 4. Charts 5. Footer

------------------------------------------------------------------------

# 16. API Caching

Use: - Next.js revalidation - SWR - TanStack Query

------------------------------------------------------------------------

# 17. Firebase Optimization

-   Paginate Firestore queries
-   Fetch only required fields
-   Add indexes
-   Cache profile data
-   Use Cloud Functions for privileged logic

------------------------------------------------------------------------

# 18. Security

-   Firebase Authentication
-   Firestore Security Rules
-   CSP headers
-   HTTPS
-   Rate limiting
-   MFA
-   RBAC
-   Session timeout

------------------------------------------------------------------------

# 19. Core Web Vitals Targets

  Metric      Target
  -------- ---------
  LCP         \<2.5s
  INP        \<200ms
  CLS          \<0.1
  TTFB       \<800ms

------------------------------------------------------------------------

# 20. Enterprise UX Checklist

-   Mobile-first
-   Responsive typography
-   Responsive grids
-   Optimized images
-   Lazy loading
-   Dynamic imports
-   Virtualized tables
-   Accessible forms
-   Large touch targets
-   Skeleton screens
-   Offline-ready PWA
-   Monitoring with Vercel Analytics
-   Lighthouse score \>90
-   Firebase query optimization

------------------------------------------------------------------------

# Recommended Architecture

``` text
User
 │
 ▼
Mobile/Desktop Browser
 │
 ▼
Vercel CDN
 │
 ▼
Next.js Application
 │
 ├── Firebase Authentication
 ├── Firestore
 ├── Cloud Storage
 └── Cloud Functions
```

# Best Practices

-   Use responsive tables or convert them to cards on phones.
-   Minimize JavaScript shipped to mobile.
-   Test on real Android and iPhone devices.
-   Monitor Core Web Vitals continuously.
-   Keep marketing site and membership portal as separate deployments.
