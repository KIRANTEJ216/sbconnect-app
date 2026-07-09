# Remotion Demo Video Prompt — SB Connect

Create a 45-60 second demo video using Remotion that showcases the SB Connect business networking app. Use smooth transitions, animated text reveals, and screen mockups.

---

## Brand Identity

- **App Name:** SB Connect
- **Tagline:** "Business Network"
- **Motto:** "No Politics Only Business"
- **Developer:** FloLogixAutomations (flologixautomations.com)
- **Target Audience:** Business owners, entrepreneurs, professionals in India looking to network and trade

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#2A11A6` | Deep purple — main brand color, buttons, links |
| Primary hover | `#1B0965` | Darker purple |
| Primary light | `#E8E3FF` | Soft lavender backgrounds, active states |
| Secondary | `#B536C5` | Magenta-purple accent |
| Accent/Success | `#16A34A` | Green for positive actions |
| Canvas bg | `#FAF8F5` | Warm off-white page background |
| Surface | `#FFFFFF` | White cards |
| Surface warm | `#FDFCFA` | Slightly warmer white for sidebar |
| Charcoal | `#1C1B18` | Near-black for headings |
| Steel | `#6B6560` | Muted gray for secondary text |
| Border | `#E2DDD6` | Light warm border |
| Danger | `#E7250C` | Red for destructive actions |
| Warning | `#F59E0B` | Amber for alerts |
| Luxury gold | `#D4A853` | Gold accent |

**Gradients to use:**
- Primary gradient: `linear-gradient(135deg, #2A11A6, #B536C5, #552559)`
- Animated gradient text: shift the gradient over time

## Typography

- **Display/Headings:** `'Instrument Sans'`, `'Poppins'`, system-ui (bold, tight tracking)
- **Body:** `'Inter'`, `'Open Sans'`, system-ui
- **Monospace:** `'JetBrains Mono'`, `'SF Mono'`
- **Style:** Clean, modern, premium feel with tight letter-spacing on headings

## Visual Style

- Cards with subtle shadows and warm borders
- Frosted glass effect (backdrop blur) on overlays
- Gradient accent line (2px) on top of stat cards
- Rounded corners: cards 16px, buttons 10px, badges 9999px
- Background: fixed radial gradients (purple top-left, magenta bottom-right at 3% opacity)

---

## Demo Script (Scenes)

### Scene 1: Brand Intro (0-5s)
- **Visual:** Center-aligned. Logo treatment — large "SB Connect" in gradient text (primary → secondary), subtitle "Business Network" in steel below, then "No Politics Only Business" fades in
- **Animation:** Text scales up from 0.8 → 1, gradient animates horizontally, subtle glow behind
- **Duration:** 5 seconds
- **Audio:** Soft ambient intro music

### Scene 2: Dashboard / Home (5-12s)
- **Mockup:** Browser window showing the dashboard
- **Visual:** Show the dashboard page with:
  - TopBar with date (Indian locale) and large ₹ revenue amount with animated gradient
  - Marquee bar scrolling announcements
  - Stats cards: Total Requests, Total Business Value, Attendance Compliance
  - Leaderboard section showing top businesses ranked by revenue
- **Animation:** Cards stagger in (slide up + fade), revenue counter counts up
- **Voiceover:** "SB Connect brings business owners together. Track deals, network with peers, and grow your business — all in one place."

### Scene 3: Business Directory (12-20s)
- **Mockup:** Browser showing `/profiles` directory page
- **Visual:** Search bar at top, grid of business profile cards showing company name, owner, categories, status badges
- **Animation:** Cards stagger in, search bar highlights, typing animation in search
- **Voiceover:** "Browse hundreds of verified business profiles. Find partners, suppliers, and clients by category or keyword."

### Scene 4: Requests & Deals (20-30s)
- **Mockup:** Split screen — left side `/requests` listing page, right side deal award modal
- **Visual:** 
  - Left: Request cards with category badges, budget amounts, status
  - Right: Deal award flow showing "Deal Closed" with amount
- **Animation:** Left side fades in first, divider line animates, right side slides in
- **Voiceover:** "Post business opportunities or browse open requests. When a match is found, close the deal and track the value on the live revenue counter."

### Scene 5: Meeting Attendance & RSVP (30-38s)
- **Mockup:** `/attendance` page + QR code overlay
- **Visual:**
  - Upcoming meetings card with RSVP buttons (Yes/No)
  - QR code scanning interface
  - Attendance history with checkmarks
- **Animation:** QR code pulses, checkmark animates on successful scan, RSVP buttons press
- **Voiceover:** "Stay engaged with monthly meetings. RSVP from the dashboard and mark your attendance by scanning the QR code at the venue."

### Scene 6: Admin Panel (38-45s)
- **Mockup:** `/admin` page showing multiple collapsible sections
- **Visual:**
  - Meeting management with RSVP stats `4/116` instead of `4`
  - Verification requests queue with approve buttons
  - Business Directory table
  - Membership expiry tracking
- **Animation:** Sections expand one after another, counts animate up
- **Voiceover:** "Admins get full control. Verify new members, create meetings with QR codes, track RSVPs against total members, and monitor membership renewals."

### Scene 7: Messaging & Chat (45-52s)
- **Mockup:** Chat interface
- **Visual:** Conversation list with unread badges, message thread with timestamps
- **Animation:** Messages appear with slide-in, typing indicator
- **Voiceover:** "Connect directly with members through built-in messaging. Discuss deals, share contacts, and build relationships."

### Scene 8: Closing / CTA (52-60s)
- **Visual:** Full screen. "SB Connect" logo centered, "Join the Network" button below, "No Politics Only Business" at bottom. Background: warm gradient with subtle radial glows
- **Animation:** Logo fades up, tagline fades, button pulses gently
- **Voiceover:** "SB Connect. No politics, only business. Join the network today."
- **Footer text:** "Developed by FloLogixAutomations"

---

## Technical Requirements

- **Resolution:** 1920x1080 (16:9) or 1080x1920 (9:16 for mobile/Reels)
- **Frame rate:** 30fps
- **Codec:** H.264
- **Duration:** 55-65 seconds
- **Transitions:** Use spring-based transitions (stiffness: 100, damping: 20) between scenes
- **Easing:** `cubic-bezier(0.25, 0.1, 0.25, 1)` for most animations
- **Mockup frames:** Browser window frame with subtle shadow, rounded corners (12px), light border
- **Text animations:** Use `interpolate` for counters, `spring` for entrance animations

## Composition Structure

```
<Composition id="SBConnectDemo">
  - Scene1_BrandIntro (0-5s)
  - Scene2_Dashboard (5-12s)
  - Scene3_Directory (12-20s)
  - Scene4_Requests (20-30s)
  - Scene5_Attendance (30-38s)
  - Scene6_Admin (38-45s)
  - Scene7_Messaging (45-52s)
  - Scene8_Closing (52-60s)
</Composition>
```

Each scene should be a separate `<Sequence>` component with `from={startFrame}` and `durationInFrames={duration}`.

## Remotion-Specific Tips

- Use `useCurrentFrame()` and `useVideoConfig()` for timing logic
- Use `spring({ fps, frame })` for natural motion
- Use `interpolate(frame, [start, end], [from, to])` for counters and opacity
- Use `<TransitionSeries>` or manual `<Sequence>` components for scene ordering
- Import Google Fonts (Instrument Sans, Inter, JetBrains Mono) via `loadFont`
- Use `@remotion/player` if you want an interactive preview
- Output: `npx remotion render` for final MP4

---

## App Color Tokens for Tailwind/Inline Styles

```css
:root {
  --primary: #2A11A6;
  --primary-hover: #1B0965;
  --primary-light: #E8E3FF;
  --secondary: #B536C5;
  --accent: #16A34A;
  --canvas: #FAF8F5;
  --surface: #FFFFFF;
  --surface-warm: #FDFCFA;
  --charcoal: #1C1B18;
  --steel: #6B6560;
  --muted: #8C8680;
  --border: #E2DDD6;
  --danger: #E7250C;
  --warning: #F59E0B;
  --luxury-gold: #D4A853;
  --font-sans: 'Instrument Sans', 'Inter', system-ui;
  --font-mono: 'JetBrains Mono', monospace;
}
```
