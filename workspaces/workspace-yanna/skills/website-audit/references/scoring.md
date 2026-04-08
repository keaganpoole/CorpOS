# Page Quality Score — Scoring Rubric

## Score Scale

| Score Range | Label | Description | Decision |
|-------------|-------|-------------|----------|
| 0 | No Website | No website exists for this business | SAVE |
| 1-20 | Critical | Broken, placeholder, under construction, or domain expired | SAVE |
| 21-40 | Severely Outdated | Looks 10+ years old, barely functional, unusable on mobile | SAVE |
| 41-60 | Below Average | Dated design, poor mobile experience, weak or missing CTAs | SAVE |
| 61-75 | Acceptable | Functional but unimpressive, some issues present | BORDERLINE |
| 76-90 | Good | Modern design, mobile-friendly, clear CTAs, well-organized | SKIP |
| 91-100 | Excellent | Professional, fast, great UX, nothing to improve | SKIP |

## Category Weights

When scoring, weight these categories:

| Category | Weight | What to check |
|----------|--------|--------------|
| Mobile Responsiveness | 25% | Does it work on phones? Layout breaks? Text readable? |
| Visual Design | 25% | Colors, fonts, spacing, overall look. Modern or dated? |
| Functionality | 20% | Links work? Forms submit? Features functional? |
| Content & Clarity | 15% | Clear what they do? Services listed? Contact info? |
| CTA & Lead Capture | 15% | Phone prominent? Contact form? Book online? |

## Scoring Heuristics

**Score 0:** No website at all.

**Score 1-20 triggers:**
- Domain expired or parking page
- "Under construction" placeholder
- Site completely broken (blank page, errors)
- Template site with no customization

**Score 21-40 triggers:**
- Site built with Flash or deprecated tech
- Desktop-only layout, completely broken on mobile
- No contact information anywhere
- Stock photos with no real content
- Copyright date 2015 or earlier with no updates

**Score 41-60 triggers:**
- Dated color scheme (neon, gradients, bevels)
- Non-responsive but somewhat usable on mobile
- Contact info present but hard to find
- No clear CTA above the fold
- Small, low-quality images
- Navigation confusing or cluttered

**Score 61-75 triggers:**
- Functional but plain
- Mobile works but isn't optimized
- CTA exists but not prominent
- Content is adequate but not compelling
- Some dated elements mixed with modern ones

**Score 76-90 triggers:**
- Clean, modern design
- Responsive mobile layout
- Clear CTAs
- Good content and imagery
- Fast loading

**Score 91-100 triggers:**
- Everything in 76-90 plus:
- Online booking/ordering
- Excellent UX
- Strong branding
- Animations/polish
- SEO optimized

## Edge Cases

- **Social media only (no website):** Score 0 — "No Website"
- **Directory listing only (Yelp, Google):** Score 0 — "No Website"
- **Landing page with contact info:** Score 20-40 depending on quality
- **Modern template but minimal content:** Score 50-65
- **Working site but wrong business:** Score N/A — skip (not our target)
