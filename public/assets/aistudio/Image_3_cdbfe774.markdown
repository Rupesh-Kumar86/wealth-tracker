---
name: High-Trust Glass Fintech
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#1f1f21'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e4e2e4'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#e4e2e4'
  inverse-on-surface: '#303032'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#c3c0ff'
  on-secondary: '#1d00a5'
  secondary-container: '#3626ce'
  on-secondary-container: '#b3b1ff'
  tertiary: '#dec29a'
  on-tertiary: '#3e2d11'
  tertiary-container: '#231500'
  on-tertiary-container: '#957d5a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#131315'
  on-background: '#e4e2e4'
  surface-variant: '#353436'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

# Design System Specification: Modern Glassmorphism & High-Trust Fintech (Dark Mode)

## 1. Overview & Philosophy
Inspired by Apple's translucent UI and refined fintech platforms (e.g. Stripe, Mercury, Wealthfront), configured for a high-contrast dark mode environment. It combines crisp spatial depth, high contrast financial legibility, subtle borders, and vivid status accents.

- Core Principles:
  - Translucency & Crispness: Elevated cards on deep slate canvas with delicate borders and subtle glass accents.
  - Financial Rigor: Monospaced/tabular figures, precise data curves, and distinct semantic coloring for assets vs debt.
  - Semantic Hierarchy: Deep navy/slate for structure, Emerald (#10B981) for gains/savings, Coral/Amber (#EF4444 / #F59E0B) for debt/alerts, Indigo (#4F46E5) for forward projections.

## 2. Color Palette & Surface Materials
- Background Canvas: Dark slate foundation
- Surface Cards: Deep slate surfaces with subtle glass backdrop
- Borders: Subtle dark mode borders with rim highlights
- Primary Accent: #0F172A & #4F46E5 (Indigo-600)
- Wealth / Growth Accent: #10B981 (Emerald-500)
- Debt / Alert Accent: #EF4444 (Rose-500) & #F59E0B (Amber-500)
- Text Hierarchy:
  - Heading & Primary: #F8FAFC
  - Secondary: #94A3B8 (slate-400)
  - Muted: #64748B (slate-500)

## 3. Typography
- Font Family: Inter, system-ui, sans-serif
- Numbers / Financial Figures: font-mono or tabular-nums
- Title: 28px/32px, font-bold
- Section Heading: 18px/20px, font-semibold
- Body / Labels: 13px/14px, font-medium
- Badges & Micro: 11px/12px, font-semibold

## 4. Components & Elevation
- Glass Cards: 16px/20px border radius, shadow-sm, subtle dark borders
- Interactive Sliders & Inputs: Recessed glass styling with indigo/emerald accent rings
- Status Badges: Soft tinted pill badges optimized for dark mode