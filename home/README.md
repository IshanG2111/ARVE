# ARVE Homepage Assets

## Files

- `arve-hero-1920x1080.png` — main dark halftone hero artwork.
- `halftone.svg` — reusable CSS/background dot texture.
- `noise.svg` — subtle print/grain texture.
- `arve-mark.svg` — editable starter ARVE mark.

## Suggested React structure

```jsx
<div className="hero-background">
  <div className="halftone" />
  <img src="/assets/arve-hero-1920x1080.png" className="hero-art" alt="" />
  <div className="noise" />
  <div className="vignette" />
</div>
```

Keep the text and UI in React/HTML. Use the artwork only as the visual layer.
