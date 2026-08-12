# ARVE — Minimalist Editorial Halftone Design System (ARVE-HT-Minimal)

> This document defines **ARVE-HT-Minimal**: a quiet, minimalist, dark editorial **Halftone & Stipple Design System** inspired by fine-line vintage lithography, high-density research workstations, and editorial typography.
> It works directly with design-engineering workflows (`pbakaus/impeccable`, `Leonxlnx/taste-skill`, `emilkowalski/skills`) to enforce strict minimalism, zero visual clutter, quiet interactions, and pristine hierarchy.

---

# 1. Visual Philosophy: Minimalist Stipple & Editorial Precision

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  MINIMALIST EDITORIAL CANVAS (FINE STIPPLE HALFTONE)                   │
│  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .    │
│  .   ┌───────────────────────────────────────────────────┐   .          │
│  .   │ ARVE  —  Autonomous Remediation & Verification    │   .          │
│  .   │ Architectural security analysis for GitHub repos   │   .          │
│  .   └───────────────────────────────────────────────────┘   .          │
│  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Rules

1. **Editorial Hierarchy**: Use refined font pairing — high-contrast display headlines (`Geist` / Serif) with generous line-height, paired with monospaced (`Geist Mono`) technical metadata.
2. **Zero Visual Noise**: No redundant pill badges on every card, no heavy 4px offset borders, no neon gradient cards. Use delicate 1px micro-borders (`rgba(255, 255, 255, 0.08)`) and quiet background surfaces.
3. **Fine-Grain Halftone Canvas**: Backgrounds feature a subtle interactive stipple/dot canvas (`HalftoneBackground`) that responds gently to mouse movements with soft radial proximity lighting.
4. **Quiet Interaction Engineering**: Transitions are fast, purposeful, and subtle (100ms–200ms `ease-out`).

---

# 2. Palette & Tokens

```css
:root {
  /* Editorial Dark Canvas Base */
  --bg:            #09090B;
  --surface:       #111115;
  --elevated:      #18181F;
  --elevated-2:    #22222B;

  /* Delicate Micro-Borders */
  --border:        rgba(255, 255, 255, 0.08);
  --border-hover:  rgba(255, 255, 255, 0.18);
  --border-strong: rgba(255, 255, 255, 0.35);

  /* Monochromatic & Accent Tokens */
  --primary:       #F4F4F5;
  --secondary:     #A1A1AA;
  --muted:         #71717A;
  --dim:           #52525B;
  --accent:        #7E8BF5;
  --accent-muted:  rgba(126, 139, 245, 0.12);

  /* Quiet Semantic Indicators (Text & Dots, Not Loud Badges) */
  --critical:      #FF6B6B;
  --high:          #FFA94D;
  --medium:        #FFD43B;
  --low:           #74C0FC;
  --success:       #51CF66;

  /* Subtle Depth Elevation */
  --shadow-subtle: 0 4px 20px rgba(0, 0, 0, 0.4);
  --shadow-glow:   0 0 30px rgba(126, 139, 245, 0.08);
}
```

---

# 3. Typography & Micro Layout

```text
Display Title:   Geist 700 • 3rem • -0.04em tracking • 1.15 line-height
Section Title:   Geist 600 • 1.5rem • -0.03em tracking
Body Text:       Geist 400 • 0.95rem • 1.6 line-height • #A1A1AA
Code / Telemetry:Geist Mono 400 • 0.82rem • Tabular Nums
Labels:          Geist Mono 500 • 10px • Uppercase • 0.12em tracking
```

---

# 4. Anti-Clutter Design Checklist

- [x] No decorative pills or badges unless strictly communicating status.
- [x] No heavy dropshadows or 3D offset blocks.
- [x] Micro-borders (`1px solid var(--border)`).
- [x] High negative space around headlines and sections.
- [x] Monospaced telemetry tags rendered inline cleanly.
