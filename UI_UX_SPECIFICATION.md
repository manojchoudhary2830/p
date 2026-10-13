# UI/UX Specification and Design System

## Project: NextGen PG Booking Platform
**Design System Name:** NextGen Cyber-Clean Dark Theme  
**Target Viewports:** Mobile (<640px), Tablet (641-1024px), Desktop / Monitor (>1024px)  
**Date:** October 2026  

---

## 1. Design Philosophy

The NextGen PG design language marries modern glassmorphism with high-contrast accessibility:
1. Premium Visual Hierarchy: A dark backdrop (#0b0f19) with layered transluscent surfaces and subtle ambient radial glows.
2. Real-Time Physical Clarity: Visual bed status cues (vacant green, locked amber, occupied muted gray) that instantly convey occupancy without reading text labels.
3. Fluid Multi-Screen Adaptability: Layouts flex naturally from compact 360px mobile screens to 4K ultrawide desktop monitors with zero horizontal overflow.
4. Frictionless Micro-Interactions: Smooth transitions (0.2s ease), subtle hover lifts (-2px), and clear focus rings.

---

## 2. Color System and Design Tokens

### 2.1 Backgrounds and Surfaces
- Canvas Main (`--bg-main`): `#0b0f19` (Deep obsidian background)
- Surface Level 1 (`--bg-surface`): `#111827` (Card and panel backgrounds)
- Translucent Glass Card (`--bg-card`): `rgba(17, 24, 39, 0.75)` with `backdrop-filter: blur(16px)`
- Translucent Card Hover (`--bg-card-hover`): `rgba(31, 41, 55, 0.85)`
- Glass Borders (`--border-glass`): `rgba(255, 255, 255, 0.08)`
- Active Focus Borders (`--border-focus`): `rgba(59, 130, 246, 0.50)`

### 2.2 Typography Colors
- Primary High-Contrast (`--text-primary`): `#f9fafb` (Headings, key data, prices)
- Secondary Body (`--text-secondary`): `#9ca3af` (Descriptions, subtitles, labels)
- Muted Notes (`--text-muted`): `#6b7280` (Micro-copy, placeholders, timestamps)

### 2.3 Semantic and Accent Palettes
- Accent Primary (`--accent-primary`): `#3b82f6` (NextGen Blue for CTAs, selected items)
- Accent Primary Hover (`--accent-primary-hover`): `#2563eb`
- Accent Purple (`--accent-purple`): `#8b5cf6` (AI features, special badges)
- Accent Emerald (`--accent-emerald`): `#10b981` (Vacant bed status, successful payments)
- Accent Amber (`--accent-amber`): `#f59e0b` (Locked bed status, featured boost listings)
- Accent Rose (`--accent-rose`): `#f43f5e` (Cancellations, error warnings, occupied beds)

---

## 3. Typography Hierarchy

The system loads Google Fonts: **Outfit** (Headings, Badges, Metrics) and **Plus Jakarta Sans** (Body, Form Controls, Tables).

| Level | Font Family | Size (Desktop) | Size (Mobile) | Weight | Line Height |
|---|---|---|---|---|---|
| Display Hero | Outfit | 3.5rem (56px) | 2.2rem (35px) | 800 | 1.15 |
| Heading 1 | Outfit | 2.2rem (35px) | 1.8rem (28px) | 700 | 1.20 |
| Heading 2 | Outfit | 1.8rem (28px) | 1.4rem (22px) | 700 | 1.25 |
| Heading 3 | Outfit | 1.3rem (21px) | 1.15rem (18px) | 600 | 1.30 |
| Body Regular | Plus Jakarta Sans | 1.0rem (16px) | 0.95rem (15px) | 400 | 1.60 |
| Body Medium | Plus Jakarta Sans | 0.95rem (15px) | 0.88rem (14px) | 500 | 1.50 |
| Caption / Micro | Plus Jakarta Sans | 0.78rem (12px) | 0.75rem (12px) | 600 | 1.40 |

---

## 4. Component Wireframes and Behavioral Specifications

### 4.1 Auto-Adaptive Header (Navbar)
- Desktop View:
  - Left: Brand mark (Icon + NextGen PG text + 4-city sub-label).
  - Center: Pill links for Jaipur, Neemrana, Behror, and Kotputli with active highlight borders.
  - Right: AI PG Finder button + User profile / Owner portal link or Login / Sign Up button.
- Mobile / Tablet View:
  - Brand mark collapses sub-label to save space.
  - Hamburger toggle button (Menu / X icon) on the top right.
  - Tapping opens an animated slide-down drawer with full 2x2 city navigation grid, AI Assistant button, and account controls.

### 4.2 Property Card Component
- Dimensions: Responsive fluid card (`minmax(min(100%, 330px), 1fr)`).
- Visual Structure:
  - Top: 180px high image preview with city badge (top right) and boost flame badge (top left if boosted).
  - Body: Star rating + verified review count, property title, area and address pin, key amenities pills.
  - Footer: Monthly rent start in large bold font + View Beds action button.
- States:
  - Default: Border 1px solid rgba(255,255,255,0.08).
  - Hover: Border color brightens, subtle 4px elevation lift with soft box-shadow glow.

### 4.3 Interactive Bed Matrix Component
- Room Tabs: Horizontal scrollable tab buttons (e.g. Single AC Room, Double Sharing Standard, Triple Cooler).
- Bed Grid: Grid of individual bed cards representing physical bed frames (e.g. Bed 101-A, Bed 101-B).
- State Indications:
  - Vacant: Soft green border (rgba(16,185,129,0.25)), subtle emerald glow on hover, cursor pointer.
  - Selected: Bright blue border (#3b82f6), blue surface tint, checkmark badge.
  - Locked: Soft amber border (rgba(245,158,11,0.35)), pulsing countdown timer display.
  - Occupied: Muted gray border, cursor not-allowed, opacity 0.5.

### 4.4 Mobile Sticky Bottom Booking Bar
- Position: Fixed at the very bottom of the screen on devices under 768px width.
- Content:
  - Left: Rent price (₹5,500/mo) and token deposit hint.
  - Right: 'Select Bed' or 'Pay Deposit & Book' button.
- Interaction: Clicking smoothly auto-scrolls the viewport directly to the Bed Selection matrix.

### 4.5 Modals (AuthModal & AiAssistantModal)
- Backdrop: Deep dark overlay (`rgba(0, 0, 0, 0.75)`) with backdrop blur.
- Window: Max-width 520px on desktop; 94vw on mobile devices.
- Scrolling: `max-height: 90vh` with inner touch scrolling to prevent clipping on mobile keyboards.

---

## 5. Accessibility and Usability Standards

- Contrast Compliance: All text elements achieve WCAG 2.1 Level AA color contrast ratio (minimum 4.5:1 against card backgrounds).
- Keyboard Traversal: All buttons, links, and form inputs support standard Tab key cycling with visible outline rings.
- Touch Targets: Every interactive element on mobile viewports has a minimum hit target size of 44px by 44px.
- Screen Reader Support: Form inputs include descriptive placeholders, labels, and aria-describedby associations.
