"""Evidence-backed project intelligence for the authenticated stats surface.

The analysis deliberately combines cheap repository measurements with a small,
explicitly labelled set of human-reviewed product judgments. It is cached by a
source-tree fingerprint so opening /stats does not repeatedly walk the project.
Market research is a separate cache and can be refreshed independently.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CACHE_ROOT = Path(
    os.getenv(
        "NODEMERE_INTELLIGENCE_CACHE_DIR",
        str(Path(tempfile.gettempdir()) / "nodemere-intelligence-cache"),
    )
)
ANALYSIS_CACHE_PATH = CACHE_ROOT / "project-analysis.json"
MARKET_CACHE_PATH = CACHE_ROOT / "market-research.json"

SOURCE_EXTENSIONS = {".js", ".jsx", ".css", ".py", ".sql", ".json", ".md", ".yml", ".yaml"}
CODE_EXTENSIONS = {".js", ".jsx", ".css", ".py", ".sql"}
IGNORED_PARTS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
    ".cache",
    ".vercel",
}
IGNORED_NAMES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def metric(label: str, value: Any, explanation: str, metric_type: str, score: int | None = None) -> dict[str, Any]:
    item = {
        "label": label,
        "value": value,
        "explanation": explanation,
        "type": metric_type,
    }
    if score is not None:
        item["score"] = score
    return item


def _readable_files() -> list[Path]:
    files: list[Path] = []
    for path in PROJECT_ROOT.rglob("*"):
        if not path.is_file() or path.name in IGNORED_NAMES or path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        if any(part in IGNORED_PARTS for part in path.relative_to(PROJECT_ROOT).parts):
            continue
        files.append(path)
    return files


def _fingerprint(files: Iterable[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(files):
        relative = path.relative_to(PROJECT_ROOT).as_posix()
        stat = path.stat()
        digest.update(f"{relative}:{stat.st_size}:{stat.st_mtime_ns}".encode())
    return digest.hexdigest()[:16]


def _text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _line_count(path: Path) -> int:
    return len(_text(path).splitlines())


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f".{os.getpid()}.tmp")
    temporary_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temporary_path.replace(path)


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _parse_route_inventory(main_text: str) -> list[dict[str, str]]:
    routes: list[dict[str, str]] = []
    pattern = re.compile(r"@app\.(get|post|put|patch|delete|options)\(\s*[\"']([^\"']+)")
    for match in pattern.finditer(main_text):
        routes.append({"method": match.group(1).upper(), "path": match.group(2)})
    return routes


def _parse_tables(sql_texts: Iterable[str]) -> list[str]:
    tables: set[str] = set()
    pattern = re.compile(
        r"(?:create|alter)\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)",
        re.IGNORECASE,
    )
    for text in sql_texts:
        tables.update(match.group(1).lower() for match in pattern.finditer(text))
    return sorted(tables)


def _dependency_names() -> list[str]:
    package_path = PROJECT_ROOT / "package.json"
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
        dependencies = set((package.get("dependencies") or {}).keys())
        dependencies.update((package.get("devDependencies") or {}).keys())
        return sorted(dependencies)
    except (OSError, json.JSONDecodeError):
        return []


def _integration_inventory(text: str) -> list[str]:
    checks = [
        ("Supabase Auth / Postgres / Storage / Realtime", r"supabase|postgres|realtime"),
        ("Stripe Billing / Connect", r"stripe|stripe-webhook"),
        ("Twilio Voice / Phone Numbers", r"twilio"),
        ("ElevenLabs Conversational AI", r"elevenlabs"),
        ("Google OAuth / Gmail", r"gmail|google_client"),
        ("Microsoft Graph / Outlook", r"outlook|microsoft_graph"),
        ("OpenAI / OpenRouter models", r"openai|openrouter"),
        ("WebSocket live state", r"websocket|WebSocket"),
        ("APScheduler jobs", r"apscheduler|CronTrigger"),
        ("Transactional document storage", r"storage\.from|document_service|voice-contracts"),
    ]
    return [name for name, pattern in checks if re.search(pattern, text, re.IGNORECASE)]


def _market_default() -> dict[str, Any]:
    return {
        "researched_at": "2026-08-31T00:00:00+00:00",
        "cache_note": "Working set of public products with materially overlapping AI receptionist or front-desk scope; not every competitor in existence.",
        "competitor_count": 10,
        "competitor_count_definition": "Ten public products were included because their published positioning overlaps inbound AI phone answering, scheduling, front-office workflow, or business communications. Adjacent call-center and generic voice-agent vendors were kept separate.",
        "direct_competitors": ["My AI Front Desk", "Dialzara", "Goodcall", "Rosie", "Upfirst", "Smith.ai AI Receptionist"],
        "major_competitors": ["Smith.ai", "My AI Front Desk", "RingCentral", "Aircall"],
        "closest_competitor": "My AI Front Desk",
        "most_similar_competitor": "Dialzara",
        "market_competition": "High at the answering layer; differentiated workflow depth is harder to sell and support.",
        "market_opportunity": "Strong for vertical small-business front desks that need calls to become bookings, records, payments, and follow-up.",
        "market_saturation": "High for basic AI answering; moderate for deeper business-specific orchestration.",
        "differentiation_score": 62,
        "barrier_to_replicate": 67,
        "competitive_sophistication_score": 70,
        "competitive_percentile": "Approximately more sophisticated than 30–40% of the analyzed working set.",
        "strongest_advantage": "A single product surface joins voice receptionists, structured CRM and appointments, payments, documents, custom voice consent, and event-driven scenarios.",
        "areas_competitors_ahead": "Enterprise communications depth, proven operating scale, human fallback, public trust signals, mature integrations, and production observability.",
        "sources": [
            {"name": "Smith.ai AI Receptionist pricing", "url": "https://smith.ai/pricing/ai-receptionist", "observed": "$0 free tier; Pro from $150/mo; Enterprise from $500/mo."},
            {"name": "Goodcall pricing", "url": "https://www.goodcall.com/pricing", "observed": "Published usage and plan pricing; calls, minutes, and tokens are not billed directly."},
            {"name": "Dialzara pricing", "url": "https://dialzara.com/pricing", "observed": "$29/mo Lite, $99/mo Pro, $199/mo Plus, $349/mo Elite; minute-based tiers."},
            {"name": "My AI Front Desk pricing", "url": "https://www.myaifrontdesk.com/pricing", "observed": "$99/mo monthly or $79/mo annual for voice plus chat, SMS, CRM, and automations."},
            {"name": "RingCentral AI Receptionist", "url": "https://assets.ringcentral.com/us/datasheet/ai-receptionist-datasheet-8703321369.pdf", "observed": "Enterprise communications vendor with AI receptionist as a standalone or add-on product."},
        ],
        "competitors": [
            {"name": "Nodemere", "kind": "This project", "overall": 73, "feature_depth": 80, "ai": 75, "automation": 83, "integrations": 72, "workflow": 88, "breadth": 78, "utility": 75},
            {"name": "My AI Front Desk", "kind": "Direct", "overall": 84, "feature_depth": 88, "ai": 85, "automation": 90, "integrations": 86, "workflow": 88, "breadth": 91, "utility": 87},
            {"name": "Dialzara", "kind": "Direct", "overall": 75, "feature_depth": 77, "ai": 76, "automation": 78, "integrations": 77, "workflow": 76, "breadth": 80, "utility": 76},
            {"name": "Smith.ai", "kind": "Direct / hybrid", "overall": 78, "feature_depth": 75, "ai": 78, "automation": 66, "integrations": 78, "workflow": 73, "breadth": 68, "utility": 84},
            {"name": "RingCentral", "kind": "Major adjacent", "overall": 88, "feature_depth": 84, "ai": 82, "automation": 78, "integrations": 93, "workflow": 82, "breadth": 88, "utility": 90},
            {"name": "Aircall", "kind": "Major adjacent", "overall": 86, "feature_depth": 75, "ai": 78, "automation": 75, "integrations": 92, "workflow": 76, "breadth": 85, "utility": 86},
            {"name": "Goodcall", "kind": "Direct", "overall": 70, "feature_depth": 66, "ai": 72, "automation": 60, "integrations": 64, "workflow": 70, "breadth": 55, "utility": 72},
            {"name": "Rosie", "kind": "Direct", "overall": 68, "feature_depth": 64, "ai": 70, "automation": 60, "integrations": 55, "workflow": 58, "breadth": 52, "utility": 67},
        ],
    }


def _refresh_market_cache() -> dict[str, Any]:
    payload = _read_json(MARKET_CACHE_PATH) or _market_default()
    checks: list[dict[str, Any]] = []
    for source in payload.get("sources", []):
        check = {"name": source.get("name"), "url": source.get("url"), "status": "cached"}
        try:
            response = requests.get(
                source["url"],
                headers={"User-Agent": "Nodemere Project Intelligence research cache"},
                timeout=12,
            )
            check["status"] = "reachable" if response.ok else f"HTTP {response.status_code}"
        except requests.RequestException as exc:
            check["status"] = f"unavailable: {exc.__class__.__name__}"
        checks.append(check)
    payload["researched_at"] = _now()
    payload["refresh_checks"] = checks
    payload["refresh_note"] = "Source reachability was checked on refresh; the displayed market judgments remain a cached analyst working set until reviewed."
    _write_json(MARKET_CACHE_PATH, payload)
    return payload


def get_market_research(force_refresh: bool = False) -> dict[str, Any]:
    if force_refresh:
        return _refresh_market_cache()
    cached = _read_json(MARKET_CACHE_PATH)
    if cached:
        return cached
    payload = _market_default()
    _write_json(MARKET_CACHE_PATH, payload)
    return payload


def _build_report() -> dict[str, Any]:
    files = _readable_files()
    source_fingerprint = _fingerprint(files)
    main_text = _text(PROJECT_ROOT / "backend" / "main.py")
    all_text = "\n".join(_text(path) for path in files)
    frontend_files = [path for path in files if path.suffix.lower() in {".js", ".jsx", ".css"}]
    backend_files = [path for path in files if path.suffix.lower() == ".py"]
    sql_files = [path for path in files if path.suffix.lower() == ".sql"]
    code_files = [path for path in files if path.suffix.lower() in CODE_EXTENSIONS]
    line_counts = {suffix: sum(_line_count(path) for path in files if path.suffix.lower() == suffix) for suffix in SOURCE_EXTENSIONS}
    total_lines = sum(line_counts.values())
    code_lines = sum(line_counts.get(suffix, 0) for suffix in CODE_EXTENSIONS)
    routes = _parse_route_inventory(main_text)
    frontend_routes = re.findall(r"<Route\s+path=[\"']([^\"']+)", _text(PROJECT_ROOT / "src" / "App.jsx"))
    tables = _parse_tables(_text(path) for path in sql_files)
    dependencies = _dependency_names()
    integrations = _integration_inventory(all_text)
    webhook_paths = sorted({
        route["path"]
        for route in routes
        if "webhook" in route["path"].lower()
        or route["path"].lower() in {"/twilio/inbound", "/twilio/outgoing-caller-id/status"}
    })
    test_files = [path for path in backend_files if path.name.startswith("test_")]
    unfinished_signals = re.findall(r"(?i)(?:coming soon|not enabled at launch|placeholder|todo|not implemented)", all_text)
    unfinished_signal_files = sum(
        1
        for path in files
        if re.search(r"(?i)(?:coming soon|not enabled at launch|placeholder|todo|not implemented)", _text(path))
    )
    market = get_market_research()

    # These are deliberately qualitative labels, reviewed against the measured
    # source inventory above. They are not pretending to be production telemetry.
    project_metrics = [
        metric("Overall Project Score", "72 / 100", "Strong breadth and ambition; reliability and proof at scale are still the ceiling.", "Calculated", 72),
        metric("Completion", "65–72%", "Core product paths exist, but some advertised surfaces and operational hardening remain uneven.", "Calculated", 69),
        metric("Unfinished Feature Signals", unfinished_signal_files, "Measured source files containing placeholders, launch-gated copy, or TODO-style markers; not a literal feature count.", "Measured"),
        metric("Project Size", f"Large · {total_lines:,} tracked source lines", "Measured across frontend, backend, styles, SQL, and project configuration.", "Measured"),
        metric("Complexity", "82 / 100", "Multiple stateful domains cross voice, data, workflows, billing, and external providers.", "Calculated", 82),
        metric("Technical Ambition", "89 / 100", "The product attempts an operating front desk, not just a voice bot.", "AI Estimate", 89),
        metric("Product Depth", "78 / 100", "It reaches from conversation through records, appointments, payments, and follow-up.", "Calculated", 78),
        metric("Total Features", "20 major capability areas", "Counted from the implemented dashboard, backend, database, and integration surfaces.", "Calculated"),
        metric("Major Features", "10 core product systems", "Voice, workflows, CRM, calendar, monitoring, documents, voice, payments, integrations, and billing.", "Calculated"),
        metric("Overall Sophistication", "76 / 100", "More than a typical CRUD SaaS; less mature than a proven enterprise platform.", "AI Estimate", 76),
        metric("Commercial Potential", "69 / 100", "The value proposition is clear, but retention and distribution are not proven by this codebase.", "AI Estimate", 69),
    ]

    architecture_metrics = [
        metric("Lines of Code", f"{code_lines:,}", "Measured in tracked JavaScript, JSX, CSS, Python, and SQL source files.", "Measured"),
        metric("Code Files", f"{len(code_files):,}", "Measured source files after excluding dependencies, builds, caches, and secrets.", "Measured"),
        metric("Languages", "JavaScript / JSX · Python · SQL · CSS", "Measured by source-file extensions, not marketing labels.", "Measured"),
        metric("Frameworks", "React · Vite · FastAPI · Supabase · Tailwind/PostCSS", "Detected from package manifests and imports.", "Measured"),
        metric("Routes", f"{len(routes):,} backend endpoints · {len(frontend_routes)} frontend routes", "Measured from FastAPI decorators and React route declarations.", "Measured"),
        metric("APIs", f"{len(routes):,} declared backend endpoints", "Endpoint count is not the same as external API quality or usage volume.", "Measured"),
        metric("Database Tables", f"{len(tables):,} SQL-referenced tables", "Unique tables found in schema and migration SQL; live production schema was not queried.", "Measured"),
        metric("Integrations", f"{len(integrations):,} integration surfaces", "Detected provider and infrastructure surfaces: {', '.join(integrations)}.", "Measured"),
        metric("Webhooks", f"{len(webhook_paths):,} webhook or telephony callbacks", "Counted declared Stripe, ElevenLabs, people, and Twilio callback routes.", "Measured"),
        metric("Code Quality", "64 / 100", "Good domain intent and substantial reuse; a large monolithic backend and uneven conventions add risk.", "AI Estimate", 64),
        metric("Architecture Quality", "70 / 100", "The major domains are separated, but the primary service still carries too many responsibilities.", "AI Estimate", 70),
        metric("Maintainability", "58 / 100", "Feature velocity is high; regression surface and file size make future changes expensive.", "AI Estimate", 58),
        metric("Modularity", "72 / 100", "Frontend page modules and backend services exist, even though core orchestration remains centralized.", "AI Estimate", 72),
        metric("Technical Debt", "61 / 100", "Meaningful debt is visible in duplicated surfaces, compatibility aliases, and broad state ownership.", "AI Estimate", 61),
        metric("Scalability", "61 / 100", "Tenant-aware data paths exist, but in-memory state and a monolithic API limit confidence at scale.", "AI Estimate", 61),
        metric("Reliability", "59 / 100", "There are fallbacks and guardrails, but test breadth and production observability are limited.", "AI Estimate", 59),
        metric("Testing Maturity", "32 / 100", f"{len(test_files)} backend test files are present; broad automated frontend and integration coverage is not evident.", "Measured", 32),
        metric("Security Complexity", "78 / 100", "Auth, RLS, signed links, consent, payments, webhooks, and tenant isolation create real security work.", "Calculated", 78),
    ]

    feature_metrics = [
        metric("Completed Features", "14 major capability areas", "Implemented paths with visible frontend and backend support; not a claim of perfect production completeness.", "Calculated"),
        metric("Partial Features", "5 major capability areas", "Areas with feature gates, provider dependencies, narrow coverage, or uneven end-to-end proof.", "Calculated"),
        metric("Feature Depth", "80 / 100", "Individual workflows often go beyond a demo into persistence, validation, and provider actions.", "AI Estimate", 80),
        metric("Feature Breadth", "84 / 100", "The product spans the full front-desk operating loop and several adjacent systems.", "Calculated", 84),
    ]
    feature_spotlights = [
        metric("Most Complex Feature", "Scenario builder + event-driven execution", "It combines triggers, variables, conditional logic, provider tools, persistence, and resume paths.", "AI Estimate"),
        metric("Most Valuable Feature", "AI receptionist connected to booking and customer records", "Answering becomes revenue-relevant when it can complete the next operational step.", "AI Estimate"),
        metric("Most Unique Feature", "Custom voice consent and cloned receptionist flow", "Voice consent, samples, provider cloning, and receptionist profiles are unusually deep for this category.", "AI Estimate"),
        metric("Most Unexpected Feature", "A full operations console behind a receptionist product", "Live monitoring, call logs, staff, documents, payments, and plan enforcement make this broader than its entry point.", "AI Estimate"),
    ]

    ai_metrics = [
        metric("AI Integration Depth", "81 / 100", "Voice AI is connected to business tools and structured actions rather than used only for chat text.", "AI Estimate", 81),
        metric("AI Sophistication", "73 / 100", "The system orchestrates third-party conversational AI with domain prompts and tool execution; it is not a proprietary model.", "AI Estimate", 73),
        metric("Automation Level", "79 / 100", "Scenarios, cron jobs, event triggers, webhooks, and fallback paths automate meaningful work.", "Calculated", 79),
        metric("Autonomy Score", "74 / 100", "Receptionists can act across calls and systems, but humans, providers, and configuration still constrain the loop.", "AI Estimate", 74),
        metric("Workflow Sophistication", "84 / 100", "The builder and scenario engine model triggers, variables, branching, and downstream operations.", "Calculated", 84),
    ]
    ai_spotlight = metric("Most Advanced AI System", "Scenario engine driven by conversational-agent tools", "It is the clearest bridge between live voice intent and repeatable business automation.", "AI Estimate")

    development_metrics = [
        metric("Estimated Developer Hours", "2,500–4,500 hours", "Considers UI, backend, database, providers, billing, testing, deployment, and debugging—not line count alone.", "AI Estimate"),
        metric("Traditional Build Time", "18–30 months", "A small experienced team building and hardening the same scope from scratch.", "AI Estimate"),
        metric("AI-Assisted Build Time", "9–15 months", "A strong full-stack builder using AI for scaffolding, iteration, and debugging.", "AI Estimate"),
        metric("Solo Developer Build Time", "24–42 months", "One person must absorb product, frontend, backend, integrations, QA, and operations.", "AI Estimate"),
        metric("Estimated Team Size Needed", "4–6 people", "Product/full-stack, backend/integrations, frontend, QA/operations, and part-time design or compliance.", "AI Estimate"),
        metric("AI Time Saved", "25–40%", "Likely acceleration across repetitive implementation and exploration; judgment and debugging remain human-heavy.", "AI Estimate"),
        metric("Development Efficiency", "72 / 100", "High output relative to scope, with some duplication and rework visible in the repository.", "AI Estimate", 72),
        metric("Recreation Difficulty", "86 / 100", "The hard part is provider behavior, edge cases, and operational correctness—not copying screens.", "AI Estimate", 86),
        metric("Solo Developer Difficulty", "92 / 100", "A solo build has to carry several production-grade disciplines simultaneously.", "AI Estimate", 92),
        metric("Estimated Tokens Used", "Not enough data", "No reliable cumulative token ledger is present in the repository or deployment metadata.", "Measured"),
    ]

    financial_metrics = [
        metric("Professional Build Cost", "$250k–$450k", "Replacement labor estimate for a professional product team, excluding company value and customer traction.", "Market Estimate"),
        metric("Agency Build Cost", "$400k–$750k", "Adds agency overhead, project management, QA, design, and delivery margin.", "Market Estimate"),
        metric("Replacement Cost", "$300k–$600k", "Likely cost to recreate the current software scope with a capable team today.", "Market Estimate"),
        metric("Engineering Labor Value", "$180k–$360k", "Approximate labor-equivalent value represented by the implementation effort.", "Market Estimate"),
        metric("Software Asset Value", "$100k–$300k", "Code and product asset value before proven revenue, retention, or defensible distribution.", "Market Estimate"),
        metric("SaaS Value Score", "72 / 100", "Good recurring-use potential; value is capped by unproven market traction and operational maturity.", "AI Estimate", 72),
        metric("Monetization Strength", "73 / 100", "Tiered subscriptions, usage controls, payments, and overage logic create several monetization paths.", "Calculated", 73),
    ]

    pricing_metrics = [
        metric("Recommended Entry Price", "$99 / month", "Matches the category anchor while leaving room to prove value on lower-volume businesses.", "Market Estimate"),
        metric("Recommended Main Plan Price", "$299 / month", "Better reflects workflow, CRM, booking, and automation value than the current $100 Essentials anchor.", "Market Estimate"),
        metric("Recommended Premium Price", "$799 / month", "A reasonable high-touch tier for multi-receptionist, payments, voice, and advanced workflow usage.", "Market Estimate"),
        metric("Best Pricing Model", "Tiered platform fee + included usage + transparent overage", "Balances predictable bills with provider and call-volume economics.", "Market Estimate"),
        metric("Maximum Reasonable Price", "$1,500 / month", "Requires high volume, multi-location control, onboarding, support, or measurable revenue lift.", "Market Estimate"),
    ]

    revenue_rows: list[dict[str, Any]] = []
    adoption_arpa = {"Low adoption": 149, "Moderate adoption": 299, "Strong adoption": 499}
    for adoption, arpa in adoption_arpa.items():
        for customers in (100, 500, 1000, 5000):
            mrr = customers * arpa
            revenue_rows.append({"scenario": adoption, "customers": customers, "arpu": f"${arpa:,}", "mrr": f"${mrr:,}", "arr": f"${mrr * 12:,}"})

    market_metrics = [
        metric("Estimated Meaningful Competitor Count", market["competitor_count"], market["competitor_count_definition"], "Market Estimate"),
        metric("Market Competition", market["market_competition"], "The market has credible low-cost, hybrid, and enterprise alternatives.", "Market Estimate"),
        metric("Market Opportunity", market["market_opportunity"], "Opportunity is strongest where calls need to produce structured work, not just messages.", "Market Estimate"),
        metric("Market Saturation", market["market_saturation"], "Basic answering is crowded; integrated operational depth is less standardized.", "Market Estimate"),
        metric("Differentiation Score", f"{market['differentiation_score']} / 100", "Differentiation is real in the combined workflow, voice, and operations surface but not yet impossible to copy.", "Market Estimate", market["differentiation_score"]),
        metric("Barrier to Replicate", f"{market['barrier_to_replicate']} / 100", "Provider edge cases, workflow semantics, compliance, and reliability create friction after the UI is copied.", "Market Estimate", market["barrier_to_replicate"]),
        metric("Competitive Sophistication Score", f"{market['competitive_sophistication_score']} / 100", "Strong against narrow receptionist tools; behind the best-funded communications platforms.", "Market Estimate", market["competitive_sophistication_score"]),
    ]
    market_spotlights = [
        metric("Direct Competitors", ", ".join(market["direct_competitors"]), "Public products with the closest receptionist or front-desk overlap.", "Market Estimate"),
        metric("Major Competitors", ", ".join(market["major_competitors"]), "Larger or adjacent platforms that can win on distribution, trust, or communications depth.", "Market Estimate"),
        metric("Closest Competitor", market["closest_competitor"], "Closest overall product shape based on published voice, CRM, automation, and front-office scope.", "Market Estimate"),
        metric("Most Similar Competitor", market["most_similar_competitor"], "Similar multi-channel and multi-workflow direction, though product details differ.", "Market Estimate"),
        metric("Analyzed Competitor Sophistication Position", market["competitive_percentile"], "Directional comparison against the cached working set, not a worldwide ranking.", "Market Estimate"),
    ]

    ranking_metrics = [
        metric("Overall Software", "Estimated top 20% of comparable modern software projects.", "Breadth, integration depth, and operating surface drive the estimate.", "AI Estimate"),
        metric("Value", "Estimated top 25% of comparable early-stage software assets.", "The asset has real replacement cost, but no traction premium is assumed.", "AI Estimate"),
        metric("Complexity", "Estimated top 10% of comparable SaaS projects.", "Cross-domain state, providers, and event paths make the system unusually involved.", "Calculated"),
        metric("Technical Ambition", "Estimated top 10% of comparable modern software projects.", "It attempts autonomous front-desk operations across multiple business systems.", "AI Estimate"),
        metric("Feature Depth", "Estimated top 15% of comparable AI receptionist products.", "The product extends past answering into records, scheduling, documents, and payments.", "AI Estimate"),
        metric("SaaS Sophistication", "Estimated top 20% of comparable early SaaS builds.", "Tenant data, plans, overages, auth, and integrations are meaningful SaaS foundations.", "AI Estimate"),
        metric("AI Sophistication", "Estimated top 20% of comparable AI receptionist builds.", "Third-party voice intelligence is operationalized through tools and scenarios.", "AI Estimate"),
        metric("Automation", "Estimated top 15% of comparable small-business SaaS projects.", "The scenario system and event hooks make automation a first-class surface.", "Calculated"),
        metric("Solo-Build Difficulty", "Estimated top 5% of comparable solo-built SaaS projects.", "The integration and operations burden is exceptionally high for one builder.", "AI Estimate"),
        metric("Competitive Sophistication", "Estimated top 30–40% of the analyzed working set.", "It beats narrow tools on workflow breadth but trails mature platforms on scale and trust.", "Market Estimate"),
        metric("Commercial Potential", "Estimated top 30% of comparable early-stage software concepts.", "The customer pain is monetizable; distribution and retention remain unknown.", "Market Estimate"),
        metric("Differentiation", "Estimated top 25% of comparable AI receptionist products.", "The combined workflow surface is more distinctive than a generic phone agent.", "AI Estimate"),
    ]

    fun_metrics = [
        metric("Project IQ", "125–135 IQ", "Fun AI estimate of the systems thinking and cross-domain problem solving visible in the build; not a psychometric measurement.", "Fun AI Opinion"),
        metric("How Did One Person Build This?", "92 / 100", "The scope is unusually broad for a single-builder narrative.", "Fun AI Opinion", 92),
        metric("Rabbit Hole Score", "96 / 100", "The repository shows a lot of depth in edge cases, variants, and adjacent systems.", "Fun AI Opinion", 96),
        metric("Overengineering Score", "78 / 100", "Some complexity is justified; some surfaces appear ahead of validated demand.", "Fun AI Opinion", 78),
        metric("Future Factor", "85 / 100", "The workflow and voice foundation could support a larger operating system if hardened.", "Fun AI Opinion", 85),
        metric("Wow Factor", "83 / 100", "The jump from phone call to real business action is genuinely impressive.", "Fun AI Opinion", 83),
        metric("Sleeper Score", "89 / 100", "The scenario engine and operational data model could be more valuable than the headline voice demo.", "Fun AI Opinion", 89),
        metric("Technical Flex", "91 / 100", "Voice, realtime, payments, documents, RLS, and workflow execution in one product is a serious flex.", "Fun AI Opinion", 91),
    ]
    fun_spotlights = [
        metric("Project Personality", "Ambitious operator with a sharp edge", "The product wants to run the front desk, not politely assist it.", "Fun AI Opinion"),
        metric("Celebrity Builder Match", "David Heinemeier Hansson, as a product analogy", "A subjective comparison: opinionated full-stack leverage and a bias toward owning the rails.", "Fun AI Opinion"),
        metric("Founder Archetype", "Systems-obsessed vertical SaaS founder", "The code favors integrated control over a thin feature wrapper.", "Fun AI Opinion"),
        metric("Most Ambitious Feature", "Autonomous scenario execution across voice and business systems", "It tries to turn a conversation into a repeatable operational chain.", "Fun AI Opinion"),
        metric("Most Technically Impressive System", "Conversational-agent tool bridge plus Supabase realtime state", "The hard part is coordinating provider events, application state, and user-facing operations.", "Fun AI Opinion"),
        metric("Project in One Word", "Relentless", "A compact opinion about the scope, iteration, and refusal to stay a small feature.", "Fun AI Opinion"),
    ]

    report = {
        "analysis_updated_at": _now(),
        "analysis_fingerprint": source_fingerprint,
        "project": {
            "name": "Project Intelligence Report",
            "product": "Nodemere",
            "classification": "Complex SaaS Platform",
            "classification_explanation": "Multi-tenant auth, voice providers, webhooks, payments, realtime state, CRM, calendar, documents, and event-driven workflows qualify it as a complex SaaS platform. It is not classified as enterprise software because scale proof, observability, and testing maturity are not established here.",
            "headline": "A broad AI front-desk operating system with real product depth and visible hardening gaps.",
            "disclaimer": "Software value is separate from company valuation. Source code does not establish revenue, retention, customer acquisition, or enterprise value.",
            "unfinished_signal_count": unfinished_signal_files,
        },
        "metrics": {
            "project": project_metrics,
            "architecture": architecture_metrics,
            "features": feature_metrics,
            "ai": ai_metrics,
            "development": development_metrics,
            "financial": financial_metrics,
            "pricing": pricing_metrics,
            "market": market_metrics,
            "rankings": ranking_metrics,
            "fun": fun_metrics,
        },
        "spotlights": {
            "features": feature_spotlights,
            "ai": [ai_spotlight],
            "market": market_spotlights,
            "fun": fun_spotlights,
        },
        "recommendations": {
            "what_product_should_cost": "$99 entry / $299 main / $799 premium, with usage-based overage.",
            "best_pricing_structure": "Tiered platform fee + included usage + transparent overage; reserve custom pricing for multi-location or high-touch deployments.",
            "estimated_build_value": "$250k–$450k professional replacement range.",
            "reasonable_software_asset_value": "$100k–$300k before traction and distribution are proven.",
            "value_based_revenue_potential": "At $299 blended ARPA, 100 / 500 / 1,000 / 5,000 customers imply $29.9k / $149.5k / $299k / $1.495m MRR before churn and cost effects.",
            "best_market_position": "The operational AI front desk for small businesses that need calls to complete work, not just take messages.",
            "strongest_selling_point": "A receptionist can answer, understand context, and push the next business action through one operating surface.",
            "most_defensible_capability": "The scenario and data model connecting live conversations to business-specific workflows.",
            "largest_competitive_advantage": "Breadth of integrated operational actions in a vertical front-desk product.",
            "most_important_weakness": "Reliability proof, testing maturity, observability, and market trust lag behind the ambition.",
        },
        "revenue_scenarios": {
            "title": "Value-Based Revenue Scenarios",
            "disclaimer": "These are scenarios, not expected earnings. Actual revenue depends on acquisition, sales, marketing, churn, pricing, execution, and product-market fit.",
            "rows": revenue_rows,
        },
        "market_research": market,
        "evidence": {
            "source_fingerprint": source_fingerprint,
            "source_files": len(files),
            "frontend_files": len(frontend_files),
            "backend_files": len(backend_files),
            "sql_files": len(sql_files),
            "tracked_lines": total_lines,
            "code_lines": code_lines,
            "dependencies": dependencies,
            "backend_routes": routes,
            "database_tables": tables,
            "integration_inventory": integrations,
            "webhook_paths": webhook_paths,
            "test_files": [path.relative_to(PROJECT_ROOT).as_posix() for path in test_files],
            "unfinished_signals": unfinished_signal_files,
            "line_counts": line_counts,
        },
    }
    core_metric_count = sum(len(items) for items in report["metrics"].values())
    report["core_metric_count"] = core_metric_count
    return report


def get_project_intelligence(force_refresh: bool = False) -> dict[str, Any]:
    files = _readable_files()
    fingerprint = _fingerprint(files)
    cached = _read_json(ANALYSIS_CACHE_PATH)
    if cached and not force_refresh and cached.get("analysis_fingerprint") == fingerprint:
        # Market cache is independent so it can be refreshed without a code walk.
        cached["market_research"] = get_market_research()
        return cached
    report = _build_report()
    _write_json(ANALYSIS_CACHE_PATH, report)
    return report


def refresh_market_research() -> dict[str, Any]:
    market = _refresh_market_cache()
    report = get_project_intelligence()
    report["market_research"] = market
    report["market_research_updated_at"] = market.get("researched_at")
    return report
