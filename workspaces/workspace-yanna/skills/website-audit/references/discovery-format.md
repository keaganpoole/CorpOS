# Discovery — Formatting Templates

Discovery is the audit write-up that goes into the lead's `discovery` field in Supabase.

## Structure

### Part 1: Bulleted Weaknesses

Open with a bulleted list. Group by opportunity type. Include specific evidence.

```
- Outdated Design: Color scheme uses dark green gradients with Comic Sans headers. Copyright shows 2012.
- Not Mobile Friendly: Navigation menu collapses into unreadable hamburger icon. Images overflow on mobile viewport.
- No Clear CTA: No contact form or phone number visible above the fold. Contact info only in footer.
- Poor Functionality: "Request Quote" button leads to 404. Photo gallery images fail to load.
```

### Part 2: Narrative Summary

Follow with a 2-4 sentence narrative that ties it together.

```
This website appears to be from the early 2010s and has not been updated since. The visual design is dated with clashing colors and unprofessional typography. On mobile, the layout is completely broken — elements overlap and the navigation becomes unusable. There's no clear way for a potential customer to get in touch without scrolling to the bottom of the page.
```

## Example

### Example 1: No Website

**Discovery:**
```
- No Website: No web presence found. Business listed on Google Maps with address and phone only.

No website exists for this business. They appear in Google Maps with basic contact information but have no web presence whatsoever. This is a high-priority opportunity — even a simple landing page would significantly improve their visibility.
```

### Example 2: Severe Relic (Score 25)

**Discovery:**
```
- Outdated Design: Flash-based homepage with autoplay music. Blue tiled background. Copyright 2009.
- Not Mobile Friendly: Site is fixed-width 800px. Completely unusable on mobile devices.
- No Clear CTA: No contact form. Phone number buried in "Contact Us" page only.
- Broken Links: Three navigation links lead to 404 errors. Guestbook page is broken.

This site appears to be from 2009 and relies on Flash, which modern browsers no longer support. The fixed-width layout means it's completely broken on any screen under 800px. Multiple navigation links are dead, and the only way to contact the business is through a phone number hidden on a secondary page. This is one of the worst sites I've seen.
```

### Example 3: Borderline (Score 65)

**Discovery:**
```
- Outdated Design: Functional but plain. Generic WordPress template with minimal customization.
- No Clear CTA: Contact form exists but is below the fold and easy to miss.
- Limited Features: Services page lists offerings but has no pricing, photos, or testimonials.

The site is functional and has basic mobile responsiveness, but it feels like a generic template with no personality. The contact form works but isn't prominent. It gets the job done but won't impress anyone — there's clear room for improvement, though it's not an urgent priority.
```

### Example 4: Not a Relic (Score 82)

**Discovery (for prospects.json):**
```
Modern, clean design with good mobile experience. Clear CTAs with phone number and contact form above the fold. Professional photography. Fast loading. Score: 82.
```


## Rules

- Be specific. Name colors, fonts, elements, behaviors.
- Be honest. If a site is actually good, say so — don't force a relic narrative.
- Be concise. 2-4 sentences for the narrative. One line per bullet.
- Never use vague terms like "bad," "ugly," or "needs work" without explaining why.
- Include the score at the end: "Page Quality Score: 35/100"
