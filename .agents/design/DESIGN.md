---
name: Cyber-Logic Vanguard
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#efeceb'
  on-tertiary: '#313030'
  tertiary-container: '#d2d0cf'
  on-tertiary-container: '#5a5959'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  body-base:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  data-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  data-value:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '700'
    lineHeight: '1'
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 12px
  panel-gap: 8px
  stack-tight: 4px
  stack-loose: 16px
---

## Brand & Style

This design system is built for high-performance gaming utility. It targets theory-crafters and competitive players who require precision, speed, and a high information-density interface. 

The visual style is a fusion of **Corporate Modern** and **High-Tech Futurism**. It utilizes a "HUD" (Heads-Up Display) aesthetic characterized by deep blacks, luminous cyan accents, and razor-sharp structural lines. The atmosphere is clinical and analytical, evoking the feeling of a tactical command center rather than a casual toy. Whitespace is used strategically—not for emptiness, but to create "lanes" of information that the eye can track at high speeds.

## Colors

The palette is strictly high-contrast to ensure maximum legibility in low-light environments. 

- **Primary (#00E5FF):** The "Power" color. Used for interactive states, critical data points, and digital glows.
- **Neutral/Background (#000000):** The base canvas. Pure black provides the ultimate "infinite depth" for a gaming HUD.
- **Secondary Background (#1A1A1A):** Used for container surfaces to create subtle differentiation without breaking the dark-mode immersion.
- **Accents:** Pure White is reserved for primary content and body text to provide maximum contrast against the black background. High-saturation red and green are utilized sparingly for negative/positive stat deltas.

## Typography

The system utilizes **Geist** for the primary interface elements due to its technical, clean, and modern sans-serif profile. It provides excellent readability at small sizes while appearing authoritative in large headings.

**JetBrains Mono** is employed specifically for data values, numbers, and technical labels. The monospaced nature of the font ensures that numbers don't "jump" when values change dynamically (e.g., during a live damage calculation), maintaining a stable visual grid. All data labels should be set in Uppercase to reinforce the "instrument panel" aesthetic.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy, behaving like a modular dashboard. Information is packed tightly to allow the user to see all variables (equipment, buffs, enemy stats) in a single view without scrolling.

- **Grid:** A 12-column system is used for desktop, but most components are organized into "Panels" that span 3 or 4 columns.
- **Rhythm:** A strict 4px base unit is used. Panels use a 12px gutter to maintain a compact, high-density feel typical of complex RPG interfaces.
- **Responsiveness:** On mobile, panels stack vertically. Data points within panels switch from horizontal "Label: Value" pairs to vertical stacks to maintain legibility.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and **Luminous Outlines** rather than traditional shadows. 

1.  **Base Layer:** Pure #000000.
2.  **Panel Layer:** #1A1A1A with a 1px solid border of #333333.
3.  **Active/Hover State:** The 1px border transitions to the Primary Cyan (#00E5FF), often accompanied by a subtle outer glow (0px 0px 8px) of the same color.

The design avoids ambient shadows entirely to maintain a crisp, digital aesthetic. Elements "float" through color contrast and border definition, creating a flat but layered HUD experience.

## Shapes

The shape language is **Sharp (0)**. 

To emphasize the high-tech, aggressive nature of gaming hardware and software, all corners are kept at 0px radius. This reinforces the "grid-based" technical feeling. Subtle 45-degree chamfers may be used on primary action buttons or "Header" tabs to add geometric interest without introducing softness.

## Components

### Buttons
Primary buttons use a solid cyan fill with black text. Secondary buttons are ghost-style with a cyan 1px border and white text. All buttons use a "rectangular" footprint with no rounding.

### Cards / Panels
The core of the system. Panels have a 1px border (#333333) and a header area with a slightly lighter background (#222222). Content inside panels should use monospaced fonts for numerical data.

### Input Fields
Inputs are minimal: a bottom-border only or a subtle dark grey box. The focus state must trigger a full cyan border and a subtle cyan glow.

### Chips / Tags
Used for "Buffs" or "Status Effects." These are small, dark rectangles with 1px cyan borders. Active buffs use a solid cyan background with black text.

### Data Grid
Tables for multi-stat comparisons should use alternating row highlights (#080808 and #000000) and avoid vertical grid lines to keep the look clean. Cyan text should be used specifically for the "Result" or "Total Damage" column.