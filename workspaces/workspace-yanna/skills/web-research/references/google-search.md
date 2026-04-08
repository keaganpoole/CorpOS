# Google Search with agent-browser

Step-by-step for finding businesses via Google Search.

## Setup

```bash
agent-browser --session research open "https://www.google.com"
```

## Step 1: Search

```bash
agent-browser --session research snapshot -i
```

Find the search textbox ref (usually `@e2` or similar). Type the query:

```bash
agent-browser --session research type @e2 "plumbers in Portland, ME"
agent-browser --session research press Enter
```

Wait for results to load:

```bash
agent-browser --session research wait 2000
```

## Step 2: Read Results

```bash
agent-browser --session research snapshot -i
```

Results appear as links. Look for business-relevant links (not ads, not Wikipedia, not directories). Extract the URL:

```bash
agent-browser --session research get url
```

## Step 3: Visit Business Site

Click a promising result:

```bash
agent-browser --session research click @e5
agent-browser --session research wait 3000
```

Extract info:

```bash
agent-browser --session research snapshot -i
agent-browser --session research get title
agent-browser --session research get url
```

Look for: phone, email, address, business name, services.

## Step 4: Evaluate Website

Assess from snapshot and visual:

- **Outdated design** → relic candidate
- **No mobile responsiveness** → relic candidate
- **Missing contact info, no clear CTA** → relic candidate
- **Modern, clean, functional** → not a relic, skip

If it's a relic, record the business info and move on.

## Step 5: Next Result

Go back to results:

```bash
agent-browser --session research back
agent-browser --session research snapshot -i
```

Click next result. Repeat.

## Step 6: Next Page

If all results on page 1 are exhausted:

```bash
agent-browser --session research back
agent-browser --session research scroll down 500
agent-browser --session research snapshot -i
```

Look for "Next" or page 2 link. Click it.

## Step 7: Cleanup

```bash
agent-browser --session research close
```

## Query Templates

| Industry | Example Query |
|----------|--------------|
| Plumbers | `"plumbers in Portland, ME"` |
| Roofers | `"roofing companies in Lewiston, ME"` |
| Restaurants | `"restaurants in Bangor, ME"` |
| Auto repair | `"auto repair shops in Augusta, ME"` |
| HVAC | `"HVAC contractors in Biddeford, ME"` |
| Landscaping | `"landscaping services in Brunswick, ME"` |

**Pattern:** `"{industry} in {city}, {state}"`

For broader searches: `"{industry} near {city}, {state}"` or `"{industry} {state}"` for statewide.

## Tips

- Use `-i` flag on snapshot always — full snapshots are noisy
- Use `-c` for extra compact when pages are complex
- Chain commands with `&&` to reduce exec calls
- Take a screenshot if the page looks unusual and you need visual confirmation
- Don't click ads (usually labeled "Sponsored" or "Ad")
- Yelp/Thumbtack/Angi results are directories, not direct businesses — note them but prioritize direct business sites
