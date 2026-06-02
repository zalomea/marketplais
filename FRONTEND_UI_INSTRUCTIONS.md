# Frontend Design & UI Instructions

## Scope

Your task is strictly limited to frontend design and UI improvements.

You are NOT allowed to:

* Modify backend logic
* Change authentication flows
* Alter smart contracts
* Modify API routes
* Expose secrets, keys, tokens, or environment variables
* Introduce insecure patterns
* Add tracking scripts or unnecessary external dependencies
* Change business logic
* Modify database schemas
* Break existing application functionality

You must only work on:

* Layout
* Styling
* Visual hierarchy
* Component appearance
* Responsiveness
* Typography
* Spacing
* Navigation clarity
* UX polish
* Frontend-only animations and transitions

If something requires backend modification, leave a clear code comment and a short note in the PR instead of implementing it.

---

# Design Direction

The visual identity must feel:

* Professional
* Technical
* Institutional
* High-trust
* Dense and information-oriented
* Minimal but powerful

Design inspiration:

* Palantir
* Bloomberg Terminal aesthetics (modernized)
* Enterprise trading platforms
* Institutional dashboards
* High-end defense/AI software interfaces

Avoid startup “crypto casino” aesthetics.

---

# Core Visual Rules

## Colors

Primary palette:

* Navy blue
* Deep blue-gray
* White
* Soft cold grays

Suggested tones (examples):

* `#07111F`
* `#0B1628`
* `#132238`
* `#F5F7FA`
* `#D9E1EA`

Accent colors must be subtle and rare.

Avoid:

* Neon colors
* Saturated gradients
* Rainbow accents
* Bright purple/pink cyberpunk styles
* Excessive glow effects

The UI must look serious and operational.

---

## Shapes & Geometry

Use:

* Sharp borders
* Hard edges
* Structured layouts
* Grid alignment
* Rectangular containers

Avoid:

* Rounded “blob” UI
* Pill buttons
* Excessive border-radius
* Soft playful cards

Recommended:

* Border radius between `0px` and `4px` maximum
* Thin borders
* Precise spacing
* Compact components

---

# Layout Philosophy

The interface should:

* Prioritize information density
* Reduce wasted whitespace
* Feel efficient
* Surface critical data immediately
* Avoid decorative sections

Compactness is preferred over oversized spacing.

Avoid:

* Giant hero sections
* Huge padding everywhere
* Empty marketing-style layouts
* Oversized cards

The UI should resemble professional operational software, not a landing page template.

---

# Typography

Use clean modern fonts such as:

* Inter
* IBM Plex Sans
* Geist
* SF Pro
* JetBrains Mono (only for technical values)

Typography rules:

* Strong hierarchy
* Tight spacing
* Medium font weights
* Precise alignment
* Consistent sizing

Avoid:

* Oversized text
* Dramatic headings
* Trendy oversized typography
* Decorative fonts

---

# Components

## Buttons

* Sharp edges
* Compact
* Strong contrast
* Minimal animations

Hover effects should be subtle. No glowing buttons.

---

## Cards

* Thin borders
* Dense information
* Functional layout
* Minimal decoration

Cards must exist for organization, not aesthetics.

---

## Tables & Dashboards

Prioritize:

* Readability
* Scan efficiency
* Alignment
* Consistent spacing
* Fast information parsing

Professional dashboards > flashy interfaces.

---

# Animations

Animations must be:

* Minimal
* Fast
* Functional

Allowed:

* Soft hover transitions
* Opacity fades
* Small transforms

Avoid:

* Floating effects
* Elastic animations
* Excessive motion
* Dramatic parallax
* Unnecessary transitions

---

# UX Principles

The interface should communicate:

* Stability
* Precision
* Reliability
* Technical competence

Every element must justify its existence.

Remove:

* Visual clutter
* Duplicate actions
* Redundant labels
* Decorative graphics without purpose
* Emojis
* Gimmicks

---

# Responsiveness

The UI must work cleanly on:

* Desktop
* Laptop
* Tablet
* Mobile

Maintain:

* Information hierarchy
* Compactness
* Readability

Do not destroy density on desktop just to satisfy mobile layouts.

---

# Code Standards

Frontend code must be:

* Clean
* Modular
* Maintainable
* Typed where possible
* Consistent

Avoid:

* Inline styles abuse
* Massive components
* Unused dependencies
* Dead code
* Overengineered abstractions

---

# Security Constraints

Do NOT:

* Expose API keys
* Leak secrets
* Log sensitive data
* Add vulnerable packages
* Modify authentication
* Store sensitive data in localStorage unnecessarily
* Create insecure API calls

No backend/security-related changes unless explicitly requested.

---

# Final Objective

The product should feel like:

* Institutional-grade AI software
* A serious operational platform
* A high-trust technical system

Not:

* A trendy startup clone
* A crypto meme dashboard
* A flashy SaaS template

The result must look sharp, modern, dense, efficient, and professional.

---

# Changelog of edits made

Small edits were applied to the original text for clarity and grammar:

* Fixed typos and punctuation.
* Standardized headings and section order.
* Tightened wording to reduce ambiguity (e.g., clarified "leave a comment" requirement when backend changes are needed).
* Removed duplicated and inconsistent lines.

No substantive policy changes were made to your original rules or intent.
