# ARVE — Frontend Design System + AI Design Workflow

> This file is intentionally written to work **with the actual skills** from:
>
> - `pbakaus/impeccable`
> - `Leonxlnx/taste-skill`
> - `emilkowalski/skills`
>
> These are not merely inspiration references. They should be installed into the coding agent and used as part of the ARVE frontend workflow.

---

# 1. Required Design Skills

## Primary: Impeccable

Use **Impeccable as the main design-system and review workflow**.

Repository:

`https://github.com/pbakaus/impeccable`

Impeccable provides:

- design context setup
- `PRODUCT.md`
- `DESIGN.md`
- UX shaping
- layout refinement
- typography refinement
- motion refinement
- accessibility checks
- responsive checks
- anti-pattern detection
- browser/live iteration
- final polish

It currently provides 23 commands and deterministic design detectors.

### Install

From the ARVE repository root:

```bash
npx impeccable install
```

Then restart/reload the coding agent if required.

For Claude Code:

```text
/impeccable init
```

For Codex, use:

```text
$impeccable
```

The Impeccable repository explicitly recommends starting new projects with `/impeccable init`.

---

# 2. Secondary: Taste Skill

Use **Taste Skill as the anti-generic-design layer**.

Repository:

`https://github.com/Leonxlnx/taste-skill`

Install the current v2 skill:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

Taste Skill v2 is the current experimental default and specifically controls:

- DESIGN_VARIANCE
- MOTION_INTENSITY
- VISUAL_DENSITY
- design-system mapping
- anti-slop rules
- layout decisions
- spacing
- typography
- motion
- pre-flight review

The repository recommends starting with `design-taste-frontend`.

---

# 3. Optional Taste Skill Add-ons

ARVE is a dense security product, so use these selectively.

## Recommended

### Minimalist UI

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "minimalist-ui"
```

Use this to reinforce:

- editorial product UI
- restrained palette
- crisp hierarchy
- Linear/Notion-like information density

This is a good fit for ARVE's dashboard and knowledge graph UI.

### Redesign Existing Projects

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "redesign-existing-projects"
```

Use this when ARVE already has UI and the team wants to improve it rather than generate a new interface.

### GPT/Codex variant

If the team is primarily using Codex:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "gpt-taste"
```

This is the stricter GPT/Codex-oriented variant with stronger anti-slop and layout/motion enforcement.

---

# 4. Emil Kowalski Design Engineering Skill

Repository:

`https://github.com/emilkowalski/skills`

Primary skill:

```text
emil-design-eng
```

Install:

```bash
npx skills@latest add emilkowalski/skills
```

The official repository provides:

- `emil-design-eng`
- `review-animations`
- `improve-animations`
- `find-animation-opportunities`
- `animation-vocabulary`
- `apple-design`
- `pick-ui-library`

The repository's stated purpose is helping design engineers make better UI decisions, especially around animation and interaction quality.

---

# 5. Which Skill Does What?

Do NOT treat all three as interchangeable.

Use them in this order:

```text
                 ARVE DESIGN WORKFLOW

                        Brief
                          |
                          v
                  TASTE-SKILL
             Design language + dials
                          |
                          v
                   IMPECCABLE
            Structure + UX + system
                          |
                          v
                 BUILD THE UI
                          |
                          v
               EMIL DESIGN ENG
          Interaction + motion polish
                          |
                          v
                  IMPECCABLE
             Audit + polish + ship
```

## Responsibility matrix

| Problem | Primary skill |
|---|---|
| Overall visual direction | Taste Skill |
| Anti-generic / anti-slop | Taste Skill |
| Layout experimentation | Taste Skill |
| Information density | Taste Skill |
| Design system | Impeccable |
| UX architecture | Impeccable |
| Typography | Impeccable |
| Accessibility | Impeccable |
| Responsive design | Impeccable |
| Design audit | Impeccable |
| Motion decisions | Emil |
| Animation review | Emil |
| Interaction polish | Emil |
| Final consistency | Impeccable |

---

# 6. ARVE Taste Skill Configuration

ARVE is a technical security intelligence application.

Do NOT use extreme visual experimentation.

Recommended Taste Skill dials:

```text
DESIGN_VARIANCE: 4/10
MOTION_INTENSITY: 3/10
VISUAL_DENSITY: 7/10
```

### Why?

ARVE contains:

- vulnerability findings
- source code
- graphs
- attack paths
- technical metadata
- security reports

So the UI needs relatively high information density.

But the visual variance should stay restrained because security analysis needs clarity.

Motion should be subtle because users may spend long periods navigating graphs and findings.

---

# 7. ARVE Design Language

## Product character

ARVE should feel:

```text
Precise
Technical
Quiet
Research-oriented
Trustworthy
Dense
Intelligent
```

Reference mental models:

```text
Linear
+
Vercel
+
Obsidian
+
Security research workstation
```

Do NOT copy any of them.

Borrow principles, not visual assets.

---

# 8. Anti-Patterns

ARVE must explicitly avoid generic AI-generated SaaS UI.

Do NOT use:

```text
Purple → blue gradients
Glassmorphism everywhere
Huge rounded cards
Card inside card inside card
Floating blobs
Neon cyberpunk backgrounds
Particle backgrounds
Fake terminal animations
"AI" glowing text
Random 3D objects
Stock cybersecurity imagery
Excessive shadows
Every section inside a card
Huge hero typography
```

Impeccable explicitly calls out several of these recurring AI-generated design patterns, including overused fonts, gray text on colored backgrounds, excessive card nesting, pure black/gray, and bounce/elastic easing.

---

# 9. Color System

Use a restrained dark product theme.

```text
Background:
#0B0B0C

Surface:
#111113

Elevated:
#17171A

Border:
rgba(255,255,255,0.08)

Primary:
#F5F5F5

Secondary:
#A1A1AA

Muted:
#71717A

Accent:
#6E7BF2
```

Security colors should be semantic:

```text
Critical → red
High     → orange
Medium   → amber
Low      → blue
Success  → green
```

Do not use security colors as decorative accents.

---

# 10. Typography

Do NOT blindly use Inter.

Impeccable explicitly flags overused fonts such as Inter/system defaults as an anti-pattern.

Preferred:

```text
UI:
Geist

Code:
Geist Mono
```

If Geist does not fit the final visual direction, use another distinctive UI typeface rather than automatically falling back to Inter.

Typography should establish hierarchy without relying on excessive font weight.

---

# 11. ARVE Application Shell

```text
┌───────────────────────────────────────────────────────────┐
│ ARVE                              Search       Profile     │
├──────────────┬────────────────────────────────────────────┤
│              │                                            │
│ Overview     │                                            │
│ Projects     │                Main Content                 │
│              │                                            │
│ SECURITY     │                                            │
│ Findings     │                                            │
│ Attack Graph │                                            │
│              │                                            │
│ INTELLIGENCE │                                            │
│ Patterns     │                                            │
│ Knowledge    │                                            │
│              │                                            │
│ Reports      │                                            │
└──────────────┴────────────────────────────────────────────┘
```

Keep the sidebar narrow.

Use text labels primarily.

Icons should support recognition, not decorate every row.

---

# 12. Dashboard

The dashboard should prioritize security state.

```text
Good evening.

Security overview

64
Security score

2 Critical
5 High
9 Medium

Recent scans

Project             Score       Findings
my-next-app           64           16
api-server            78            8
dashboard             91            3

Priority attack path

Internet
  ↓
/api/users/:id
  ↓
Missing authorization
  ↓
User database
```

Do not turn every metric into a card.

Use cards only where grouping genuinely improves scanning.

---

# 13. Attack Graph

The attack graph is the visual centerpiece of ARVE.

It should occupy most of the screen.

```text
                    INTERNET
                        |
                        v
                 /api/users/:id
                        |
                        v
                User-controlled ID
                        |
                        v
               Missing authorization
                        |
                        v
                    MongoDB
                        |
                        v
                 Sensitive data
```

## Graph rules

- no permanent animation
- no glowing neon nodes
- no unnecessary 3D
- no decorative particle system
- selected paths may become visually emphasized
- unrelated nodes should visually recede
- graph transitions should be fast and purposeful

---

# 14. Knowledge Graph

The global ARVE graph should feel like an Obsidian-style research surface.

```text
                   SQL Injection
                  /      |       \
                 /       |        \
            Express     CWE-89   Database
                \          |        /
                 \         |       /
                  AI Security Pattern
                          |
                       Projects
```

The graph must support:

```text
Zoom
Pan
Search
Filter
Node selection
Relationship inspection
Focus
Path isolation
```

---

# 15. Finding Detail

Avoid giant cards.

Use a clean information hierarchy.

```text
Missing Object-Level Authorization

HIGH
CWE-639

src/api/users/[id].ts:42

────────────────────────────────

Evidence

<source code>

────────────────────────────────

Matched Pattern

AUTH-014

Object-level authorization weakness

────────────────────────────────

Attack Path

Internet
 ↓
/api/users/:id
 ↓
Missing authorization
 ↓
User database
```

---

# 16. Code Viewer

Use:

```text
Geist Mono
```

Show:

- line numbers
- syntax highlighting
- vulnerable line highlight
- finding marker
- file path
- endpoint
- source/sink relationships

Example:

```text
38  const userId = req.params.id;
39
40  const user = await User.findById(userId);
41
42  return res.json(user);     ← ARVE-0017
```

Clicking the finding should focus the exact source location.

---

# 17. Motion Rules

This section should be implemented using Emil's actual design-engineering guidance.

Before adding any animation:

```text
1. Should this animate?
2. Why does it animate?
3. What easing should it use?
4. How fast should it be?
```

Emil's skill explicitly recommends this decision framework and says animation should have a purpose such as spatial consistency, state indication, explanation, or feedback.

---

# 18. ARVE Motion Policy

## Animate

Use motion for:

- drawer open/close
- finding selection
- graph focus
- attack-path transitions
- scan progress
- tooltip/popover entry
- button press feedback
- expanding code context

## Do not animate

Avoid animation for:

- keyboard shortcuts
- command palette frequent interactions
- every graph node
- permanent background effects
- repeated table navigation
- routine filtering
- decorative floating objects

Emil's skill specifically recommends little or no animation for interactions users perform dozens or hundreds of times per day.

---

# 19. Animation Timing

Use Emil's actual ranges as the default baseline.

```text
Button press:
100–160ms

Tooltip / small popover:
125–200ms

Dropdown:
150–250ms

Drawer / modal:
200–500ms
```

Keep ordinary ARVE UI transitions below roughly 300ms unless there is a strong reason otherwise.

---

# 20. Easing

Do not use generic `ease-in` for interface entry.

Use:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

Use:

```text
ease-out
```

for elements entering the interface.

Use:

```text
ease-in-out
```

for movement/morphing.

Use:

```text
linear
```

for continuous progress.

Emil's actual skill explicitly recommends these curves and warns against `ease-in` for UI animations.

---

# 21. Interaction Polish

Use Emil's `emil-design-eng` skill to review:

- active states
- hover states
- focus states
- popover origins
- drawer behavior
- button press feedback
- loading states
- transitions
- perceived performance

Do not write:

```css
transition: all 300ms;
```

Prefer:

```css
transition:
  transform 160ms var(--ease-out),
  opacity 160ms var(--ease-out);
```

Animate only properties that actually need to change.

Emil's review format also expects concrete Before/After/Why comparisons when reviewing UI code.

---

# 22. Use Emil's Other Skills

After the initial UI exists:

## Review animations

Ask the agent to invoke:

```text
review-animations
```

Use this after implementing major interactions.

## Improve animations

Use:

```text
improve-animations
```

when the animation system exists but feels inconsistent.

It should identify and prioritize improvements rather than randomly redesigning motion.

## Find animation opportunities

Use:

```text
find-animation-opportunities
```

only after the product is functional.

The goal is to find places where motion improves understanding, not to add motion everywhere.

## Animation vocabulary

Use:

```text
animation-vocabulary
```

when describing an interaction to the coding agent.

For example:

```text
Use a short ease-out entrance with subtle opacity
and scale from the trigger origin.
```

rather than:

```text
Make it fancy.
```

The Emil skills repository explicitly provides these specialized skills.

---

# 23. Impeccable Workflow

## First

Install:

```bash
npx impeccable install
```

Then:

```text
/impeccable init
```

Choose:

```text
Product
```

because ARVE is an application/dashboard rather than a marketing website.

Impeccable's `init` is specifically designed to establish product context and generate shared design context for subsequent commands.

---

# 24. Then Shape Before Coding

Before implementing a major page:

```text
/impeccable shape the ARVE attack graph
```

The agent should determine:

- hierarchy
- navigation
- primary action
- graph space
- supporting context
- information density
- responsive behavior

Do not immediately ask the agent:

```text
"Build the dashboard."
```

Ask it to shape the UX first.

---

# 25. Then Build

After shaping:

```text
Build the page according to DESIGN.md and the
Impeccable shape. Use the installed Taste Skill
and do not introduce generic SaaS dashboard patterns.
```

This is where the agent actually writes the Next.js UI.

---

# 26. After Every Major Screen

Run:

```text
/impeccable critique <screen>
```

Then:

```text
/impeccable audit <screen>
```

Then fix the issues.

`critique` focuses on UX design, hierarchy and clarity; `audit` focuses on technical quality such as accessibility, performance and responsiveness.

---

# 27. Refinement Pipeline

Use this exact sequence:

```text
BRIEF
  ↓
TASTE-SKILL
  ↓
IMPECCABLE SHAPE
  ↓
IMPLEMENT
  ↓
IMPECCABLE CRITIQUE
  ↓
IMPECCABLE AUDIT
  ↓
EMIL ANIMATION REVIEW
  ↓
IMPECCABLE POLISH
  ↓
IMPECCABLE DISTILL
  ↓
SHIP
```

This is much better than asking an AI agent to "make it beautiful" once.

---

# 28. Impeccable Commands ARVE Should Actually Use

Do not use all 23 commands indiscriminately.

Use these:

```text
/impeccable init
/impeccable shape
/impeccable critique
/impeccable audit
/impeccable layout
/impeccable typeset
/impeccable animate
/impeccable clarify
/impeccable harden
/impeccable adapt
/impeccable polish
/impeccable distill
```

### Occasionally

```text
/impeccable colorize
/impeccable quieter
/impeccable bolder
```

### Avoid unless specifically needed

```text
/impeccable delight
/impeccable overdrive
```

ARVE should remain restrained.

The official Impeccable command list includes these commands and defines `distill` as stripping complexity and `polish` as the final design-system/shipping pass.

---

# 29. Impeccable CLI

Run the deterministic detector before committing frontend work:

```bash
npx impeccable detect frontend/
```

For CI:

```bash
npx impeccable detect --json frontend/
```

This lets ARVE's own frontend be checked for design anti-patterns without needing an LLM/API key.

Add this to the frontend CI pipeline later.

---

# 30. ARVE Frontend Development Protocol

Every feature should follow:

```text
1. Define UX
2. Shape it with Impeccable
3. Implement
4. Check Taste Skill direction
5. Check typography/layout
6. Check interaction
7. Review animation with Emil
8. Run Impeccable audit
9. Run deterministic detector
10. Polish
```

---

# 31. Example Agent Prompt

Use this when starting ARVE frontend development:

```text
We are building ARVE, a cybersecurity intelligence platform.

Before writing UI:

1. Read DESIGN.md.
2. Use the installed Taste Skill.
3. Use Impeccable's design workflow.
4. Treat ARVE as a product UI, not a marketing site.
5. Keep DESIGN_VARIANCE around 4/10.
6. Keep MOTION_INTENSITY around 3/10.
7. Keep VISUAL_DENSITY around 7/10.
8. Avoid generic AI SaaS patterns.
9. Use the ARVE design tokens.
10. Prioritize information hierarchy and graph readability.

For interaction and animation:
- follow emil-design-eng principles
- animate only when motion communicates state, spatial continuity, feedback, or explanation
- prefer short ease-out transitions
- avoid ease-in for UI entry
- respect prefers-reduced-motion

First shape the UX.
Do not start coding until the layout and hierarchy are clear.
```

---

# 32. Example: Building the Attack Graph

First:

```text
/impeccable shape the ARVE project attack graph
```

Then implement.

Then:

```text
/impeccable critique attack graph
```

Then:

```text
/impeccable audit attack graph
```

Then:

```text
Review the graph interactions using emil-design-eng.
Only add animation where it improves spatial understanding
or selection feedback.
```

Then:

```text
/impeccable polish attack graph
```

Finally:

```bash
npx impeccable detect frontend/
```

---

# 33. Example: Building the Dashboard

Use:

```text
/impeccable shape ARVE dashboard
```

Implement.

Then:

```text
/impeccable layout dashboard
```

```text
/impeccable typeset dashboard
```

```text
/impeccable critique dashboard
```

```text
/impeccable audit dashboard
```

Then use:

```text
emil-design-eng
```

to review:

- scan button feedback
- finding transitions
- navigation
- tooltips
- graph entry
- drawers

Finally:

```text
/impeccable distill dashboard
```

The goal is to remove anything that does not improve the security-analysis workflow.

---

# 34. Design Skill Installation for the Team

Recommended setup:

```bash
# Impeccable
npx impeccable install

# Taste Skill
npx skills add https://github.com/Leonxlnx/taste-skill \
  --skill "design-taste-frontend"

# Taste minimalist extension
npx skills add https://github.com/Leonxlnx/taste-skill \
  --skill "minimalist-ui"

# Emil
npx skills@latest add emilkowalski/skills
```

Commit the appropriate project-local skill configuration so every team member's agent follows the same design system.

Do not rely on one developer having a global installation.

---

# 35. Source Repositories

## Impeccable

https://github.com/pbakaus/impeccable

Primary purpose:
Design-system setup, UX shaping, audits, anti-pattern detection, responsive/accessibility review, refinement.

## Taste Skill

https://github.com/Leonxlnx/taste-skill

Primary purpose:
Anti-slop visual direction, layout/typography/motion/density decisions, specialized minimalist/product variants.

## Emil Kowalski Skills

https://github.com/emilkowalski/skills

Primary purpose:
Design engineering, animation decisions, interaction polish, animation review.

---

# 36. Final Rule

Do not tell the AI:

> "Make ARVE look modern."

Tell it:

> "Use the installed Taste Skill to establish the visual direction, use Impeccable to shape and audit the product UI, and use emil-design-eng to make interactions and motion feel intentional."

The skills should be part of the **development loop**, not just links inside this document.

ARVE's final frontend should feel:

```text
Minimal
       +
Dense
       +
Technical
       +
Quiet
       +
Extremely polished
```

The graph, code evidence, and security relationships should provide the visual complexity.

The surrounding UI should stay almost invisible.
