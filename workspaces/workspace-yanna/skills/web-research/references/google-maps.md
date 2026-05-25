# Google Maps with agent-browser

Step-by-step for finding businesses via Google Maps.

## Setup

```bash
agent-browser --session research open "https://www.google.com/maps"
```

Wait for Maps to load (it's heavy):

```bash
agent-browser --session research wait 5000
```

## Step 1: Handle Consent

Google may show a consent/cookie dialog. If present:

```bash
agent-browser --session research snapshot -i
```

Look for "Accept all" or "Reject all" button. Click it:

```bash
agent-browser --session research click @e1
agent-browser --session research wait 2000
```

## Step 2: Search

```bash
agent-browser --session research snapshot -i
```

Find the search box (usually prominent at top). Type the query:

```bash
agent-browser --session research type @e2 "plumbers in Portland, ME"
agent-browser --session research press Enter
```

Wait for map pins and results panel to load:

```bash
agent-browser --session research wait 5000
```

## Step 3: Read Results Panel

```bash
agent-browser --session research snapshot -i
```

Google Maps shows a scrollable list of businesses on the left. Each listing typically shows:
- Business name (link)
- Rating (stars + review count)
- Category
- Phone number
- Address
- Hours

**Extract from snapshot** — the refs let you `get text @ref` on each listing.

## Step 4: Extract Business Info

For each business in the results:

```bash
agent-browser --session research get text @e15
```

Record: name, rating, phone, address, website (if shown).

To get the website URL, click the business name to open its detail panel:

```bash
agent-browser --session research click @e15
agent-browser --session research wait 3000
agent-browser --session research snapshot -i
```

Look for a "Website" link. Extract URL:

```bash
agent-browser --session research get text @e20
```

## Step 5: Visit Business Website

If a website link exists, open it:

```bash
agent-browser --session research open "https://businesswebsite.com"
agent-browser --session research wait 3000
agent-browser --session research snapshot -i
```

Evaluate for relic status:
- Outdated design → relic candidate
- Poor mobile → relic candidate
- Missing key info → relic candidate
- Modern and functional → not a relic

## Step 6: Scroll for More Results

Go back to Maps:

```bash
agent-browser --session research back
agent-browser --session research wait 3000
```

Scroll the results panel to load more businesses:

```bash
agent-browser --session research scroll down 800
agent-browser --session research wait 2000
agent-browser --session research snapshot -i
```

Repeat Steps 3-5 for new listings.

## Step 7: Cleanup

```bash
agent-browser --session research close
```

## Query Templates for Maps

| Industry | Maps Query |
|----------|-----------|
| Plumbers | `"plumbers near Portland, ME"` |
| Roofers | `"roofing contractors Lewiston ME"` |
| Restaurants | `"restaurants in Bangor, ME"` |
| Auto repair | `"auto mechanic near Augusta, ME"` |

**Google Maps prefers natural phrases.** `"plumbers near Portland"` works better than `"plumbers in Portland, ME"` on Maps.

## Maps vs Search — When to Use Which

| Use Maps when... | Use Search when... |
|-----------------|-------------------|
| You need phone numbers and addresses fast | You need to visit websites to evaluate them |
| You want ratings and reviews | You're searching a broad or niche industry |
| You want to see businesses on a map | You need to search a specific phrase or topic |
| City-specific results | Statewide or multi-city searches |

## Tips

- Maps results panel is scrollable — scroll to get 20+ businesses per search
- Business detail cards often show phone + website directly — saves a click
- Don't waste time on chains/franchises (Starbucks, Jiffy Lube) — they have corporate sites, not relics
- If a business has no website on Maps → HIGH VALUE lead (no website = biggest opportunity)
- Use `--session research` to keep Maps cookies separate from other browsing
