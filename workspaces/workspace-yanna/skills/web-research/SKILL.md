---
name: web-research
description: Search Google and Google Maps to find businesses matching research campaign criteria using agent-browser. Use when Yanna needs to find leads via web search, navigate Google search results, interact with Google Maps to find businesses by category and location, or visit business websites for initial discovery. Triggers on "search Google", "find businesses", "Google Maps", "search for", "find leads", "look up businesses", or any web search related to lead sourcing. NOT for website audits — use lead-research skill for that.
---

# Web Research

Find businesses matching campaign criteria. Two approaches — pick the right one.

## Approach Selection

| Situation | Use |
|-----------|-----|
| Simple search query, need top results | `web_search` (built-in, free) |
| Need to click through pages, filter, interact | `agent-browser` |
| Google Maps search | `agent-browser` (required) |
| Grab a business website for quick check | `web_fetch` (built-in, free) |
| Navigate and interact with a website | `agent-browser` |

Default to `web_search` for simple lookups. Escalate to `agent-browser` only when interaction is needed.

## agent-browser Quick Reference

All commands run via `exec`. Browser persists across chained calls — use `&&` for sequences.

```
agent-browser open <url>               # Navigate
agent-browser snapshot -i              # Interactive elements only (compact, use this)
agent-browser snapshot -i -c           # Even more compact
agent-browser click @ref               # Click element by ref ID
agent-browser type @ref "text"         # Type into input
agent-browser press Enter              # Submit / confirm
agent-browser get text @ref            # Extract text from element
agent-browser get url                  # Current URL
agent-browser get title                # Page title
agent-browser scroll down [px]         # Scroll page
agent-browser back                     # Go back
agent-browser screenshot [path]        # Visual check
agent-browser close                    # Clean up browser
```

### Session Isolation

Use `--session` to keep research sessions separate (no cookie bleed between campaigns):

```
agent-browser --session research open "https://google.com"
```

### Domain Restriction

Lock navigation to specific domains for safety:

```
agent-browser --allowed-domains "google.com,*.google.com,googleapis.com" open "https://google.com"
```

### Snapshots — Your Eyes

Always use `snapshot -i` (interactive elements only). It returns a compact accessibility tree with `@ref` IDs:

```
[ref e1] button "Google Search"
[ref e2] textbox "Search" [required]
[ref e3] link "About"
```

Use refs to interact: `click @e1`, `type @e2 "plumbers Portland ME"`.

### Chaining Commands

Chain with `&&` in a single exec call — browser daemon persists between chained commands:

```
agent-browser open "https://google.com" && agent-browser snapshot -i
```

For multi-step workflows (search → click result → extract info), chain the full sequence.

## Google Search Workflow

See `references/google-search.md` for detailed step-by-step.

**Quick version:**
1. Open Google → snapshot to find search box
2. Type query → press Enter
3. Snapshot results → identify business links
4. Click result → extract business info (name, phone, address, website)
5. Navigate back → repeat for next result
6. Close browser when done

**Query format:** `"{industry} in {city}, {state}"` — e.g., `"plumbers in Portland, ME"`

## Google Maps Workflow

See `references/google-maps.md` for detailed step-by-step.

**Quick version:**
1. Open Google Maps → snapshot to find search box
2. Type `"{industry} near {city}, {state}"` → press Enter
3. Snapshot the results panel → extract business cards (name, rating, phone, address, website)
4. Scroll results panel to load more
5. Click individual listings for details
6. Close browser when done

## Lead Extraction Pattern

When visiting a business from search results:

1. `snapshot -i` — see what's on the page
2. Look for: business name, phone number, email, address, website URL
3. `get text @ref` — extract specific info
4. If no contact info on the search page, click through to the business website
5. If website is a relic → record as a lead candidate
6. If website looks professional → note but skip (not a relic)

## Environment Notes

If Chrome crashes with "Auto-launch failed" or "Chrome exited early":
1. Try `--args "--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage"`
2. If still failing, try `--executable-path` pointing to installed Chrome/Edge
3. In headless VMs, add `--disable-gpu,--headless=new` to args

## Cleanup

Always close the browser when research is done:

```
agent-browser close
```

Or for a specific session:

```
agent-browser --session research close
```

## Fallback

If `agent-browser` fails (crash, timeout, broken install):
1. Fall back to `web_search` + `web_fetch`
2. Note the issue in your update
3. Resume with agent-browser on next search
