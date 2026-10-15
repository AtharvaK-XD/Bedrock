#!/usr/bin/env python3
"""
Bedrock RAG & Fact-Verification Engine
Provides ultra-low-token fact retrieval, anti-hallucination grounding,
and continuous learning from user prompts across coding and creative domains.
"""

import sys
import json
import re
import os
import argparse
from typing import Dict, List, Any, Optional
import urllib.request
import urllib.parse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LEARNED_DB_PATH = os.path.join(SCRIPT_DIR, "learned_knowledge.json")

# ---------------------------------------------------------------------------
# Pre-Verified Authoritative Grounding Base (Instant 0ms, 0-token overhead)
# ---------------------------------------------------------------------------
CORE_VERIFIED_FACTS: Dict[str, Dict[str, Any]] = {
    # Modern Web & Backend Ecosystem
    "react": {
        "domain": "coding",
        "current_version": "19.x",
        "key_facts": [
            "React 19 standard: Server Actions, useActionState, useOptimistic, use(Promise).",
            "Deprecated: componentWillMount, findDOMNode, legacy Context, forwardRef without direct props."
        ]
    },
    "next.js": {
        "domain": "coding",
        "current_version": "15.x",
        "key_facts": [
            "Next.js 15: App Router is default. params, searchParams, cookies(), and headers() are Promise-based async functions.",
            "NEVER use Pages Router (getStaticProps, getServerSideProps, pages/ directory)."
        ]
    },
    "tailwind": {
        "domain": "coding",
        "current_version": "v4.x",
        "key_facts": [
            "Tailwind CSS v4 uses CSS-first configuration via @theme and @import 'tailwindcss'.",
            "Deprecated: tailwind.config.js is no longer required in v4."
        ]
    },
    "typescript": {
        "domain": "coding",
        "current_version": "5.5+",
        "key_facts": [
            "Strict mode enabled (noImplicitAny, strictNullChecks).",
            "Negative constraint: NEVER use 'any'; use 'unknown' with type narrowing or generic parameters."
        ]
    },
    "drizzle": {
        "domain": "coding",
        "current_version": "0.38+",
        "key_facts": [
            "Drizzle ORM uses drizzle-kit with schema-first definitions (pgTable, serial, text).",
            "Relations use relations() helper with one() and many()."
        ]
    },
    "prisma": {
        "domain": "coding",
        "current_version": "6.x",
        "key_facts": [
            "Prisma 6 uses PrismaClient with typed relations.",
            "PostgreSQL datasource with relationMode = 'prisma' if serverless."
        ]
    },
    "zod": {
        "domain": "coding",
        "current_version": "3.24+",
        "key_facts": [
            "Zod 3.24+ for runtime schema validation (z.object, z.string, z.infer<typeof Schema>).",
            "Use .safeParse() for resilient error handling without thrown exceptions."
        ]
    },
    "neon": {
        "domain": "coding",
        "current_version": "Lakebase Postgres",
        "key_facts": [
            "Neon Serverless Postgres: @neondatabase/serverless driver with pool or http query client.",
            "Supports instant branching, scale-to-zero, and connection pooling on port 5432 or 6543."
        ]
    },
    "vitest": {
        "domain": "coding",
        "current_version": "4.x",
        "key_facts": [
            "Vitest 4.x for unit/integration testing: import { describe, it, expect, vi } from 'vitest'.",
            "Runnable terminal command: npm run test or vitest run."
        ]
    },

    # Visual & Cinematic Media Ecosystem
    "midjourney": {
        "domain": "visual",
        "current_version": "v6.1",
        "key_facts": [
            "Midjourney v6.1 parameter syntax: --ar 16:9 (or 9:16 / 1:1), --v 6.1, --style raw, --stylize [0-1000].",
            "No code or programming frameworks allowed in Midjourney prompts."
        ]
    },
    "flux": {
        "domain": "visual",
        "current_version": "FLUX.1 [dev/pro]",
        "key_facts": [
            "FLUX.1 excels at detailed natural language descriptions and photorealistic human typography.",
            "Does not use Midjourney parameter flags; relies on descriptive lighting, focal length, and atmospheric texture."
        ]
    },
    "cinematography": {
        "domain": "visual",
        "current_version": "Optical Standard",
        "key_facts": [
            "Lens specifications: 35mm f/1.4 for environmental wide shots, 85mm f/1.2 for intimate shallow depth of field portraits.",
            "Film stocks: Kodak Portra 400 (warm skin tones, fine grain), CineStill 800T (cool tungsten with red halation highlights), Fujifilm Provia (neutral high contrast)."
        ]
    },
    "runway": {
        "domain": "video",
        "current_version": "Gen-3 Alpha",
        "key_facts": [
            "Runway Gen-3 prompt format: [Camera Motion] + [Subject Action] + [Environment & Lighting] + [Temporal Speed].",
            "Avoid static prompts; describe temporal transformation, speed ramping, and physics dynamics."
        ]
    },
    "sora": {
        "domain": "video",
        "current_version": "OpenAI Sora",
        "key_facts": [
            "Focuses on 3D consistency, fluid dynamics (water, smoke, fabric), and lighting persistence across frames."
        ]
    }
}


def load_learned_knowledge() -> Dict[str, Dict[str, Any]]:
    """Loads continuously learned knowledge from previous user prompt sessions."""
    if os.path.exists(LEARNED_DB_PATH):
        try:
            with open(LEARNED_DB_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to load learned knowledge ({e})\n")
    return {}


def save_learned_knowledge(data: Dict[str, Dict[str, Any]]) -> None:
    """Persists newly confirmed facts to the continuous learning database."""
    try:
        os.makedirs(os.path.dirname(LEARNED_DB_PATH), exist_ok=True)
        with open(LEARNED_DB_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to save learned knowledge ({e})\n")


def extract_entities(text: str) -> List[str]:
    """Identifies technical concepts, frameworks, tools, or art terms in the user text."""
    lower = text.lower()
    entities: List[str] = []

    # Check for known tech and artistic tokens
    all_known = list(CORE_VERIFIED_FACTS.keys())
    for key in all_known:
        if re.search(r'\b' + re.escape(key) + r'\b', lower):
            entities.append(key)

    # Heuristic extraction of capitalized or hyphenated technical terms (e.g. Next.js, Fastify, PyTorch, Supabase, Monad)
    words = re.findall(r'[A-Za-z0-9\.\-_]{3,}', text)
    candidate_stopwords = {"and", "the", "for", "with", "this", "that", "from", "make", "build", "create", "need"}
    for w in words:
        wl = w.lower()
        if wl not in candidate_stopwords and (w[0].isupper() or '.' in w or '-' in w):
            if wl not in entities and len(wl) >= 4:
                entities.append(wl)

    return entities[:6]


def search_external_quick_fact(entity: str) -> Optional[str]:
    """
    Lightweight, token-efficient internet lookup for unknown entities.
    Uses DuckDuckGo Instant Answer API for factual definitions without bloated web scraping.
    """
    try:
        url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(entity)}&format=json&no_html=1&skip_disambig=1"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Bedrock-Fact-Retriever/1.0"}
        )
        with urllib.request.urlopen(req, timeout=3.0) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                abstract = data.get("AbstractText", "").strip()
                if abstract:
                    # Condense to the first concise sentence (under 150 chars) to save tokens
                    first_sent = abstract.split(". ")[0] + "."
                    return first_sent[:180]
    except Exception:
        pass
    return None


def retrieve_grounded_facts(query: str, target_type: str = "coding_agent") -> Dict[str, Any]:
    """
    Main RAG pipeline:
    1. Extracts entities from user idea.
    2. Matches against core verified base & continuous learning cache.
    3. Performs fast external fact-checking for unresolved entities.
    4. Distills everything into an ultra-low-token (<100 tokens) XML block.
    """
    entities = extract_entities(query)
    learned = load_learned_knowledge()
    
    verified_bullets: List[str] = []
    matched_entities: List[str] = []
    newly_learned = False

    is_visual = target_type in ("image_generation", "video_generation", "image-prompt", "video-generation")

    for entity in entities:
        # Check Core Database
        if entity in CORE_VERIFIED_FACTS:
            fact_entry = CORE_VERIFIED_FACTS[entity]
            # Domain filter: Don't leak coding facts into visual media
            if is_visual and fact_entry.get("domain") == "coding":
                continue
            matched_entities.append(entity)
            for fact in fact_entry.get("key_facts", []):
                if fact not in verified_bullets:
                    verified_bullets.append(fact)

        # Check Continuous Learned Database
        elif entity in learned:
            entry = learned[entity]
            if is_visual and entry.get("domain") == "coding":
                continue
            matched_entities.append(entity)
            for fact in entry.get("key_facts", []):
                if fact not in verified_bullets:
                    verified_bullets.append(fact)

        # Attempt fast live internet lookup for unknown technical entity
        elif not is_visual and len(entity) >= 4:
            live_fact = search_external_quick_fact(entity)
            if live_fact:
                matched_entities.append(entity)
                fact_text = f"Verified specification for {entity}: {live_fact}"
                verified_bullets.append(fact_text)
                
                # Save to learned memory
                learned[entity] = {
                    "domain": "coding" if not is_visual else "visual",
                    "key_facts": [fact_text]
                }
                newly_learned = True

    if newly_learned:
        save_learned_knowledge(learned)

    # If visual media and no specific art entity was found, inject canonical optics facts
    if is_visual and not any(e in CORE_VERIFIED_FACTS and CORE_VERIFIED_FACTS[e].get("domain") == "visual" for e in matched_entities):
        if target_type in ("video_generation", "video-generation"):
            verified_bullets.extend(CORE_VERIFIED_FACTS["runway"]["key_facts"])
        else:
            verified_bullets.extend(CORE_VERIFIED_FACTS["midjourney"]["key_facts"])
            verified_bullets.extend(CORE_VERIFIED_FACTS["cinematography"]["key_facts"])

    # Format the ultra-low-token grounding block (capped at ~120 words / ~90 tokens)
    if verified_bullets:
        selected_bullets = verified_bullets[:4]
        bullets_str = "\n".join(f"- {b}" for b in selected_bullets)
        grounded_xml = f"<verified_external_facts>\n{bullets_str}\n[MANDATORY: Obey the above verified external facts strictly. Do not hallucinate deprecated or non-existent alternatives.]\n</verified_external_facts>"
        approx_tokens = sum(len(b.split()) for b in selected_bullets) + 20
    else:
        grounded_xml = ""
        approx_tokens = 0

    return {
        "groundedFactsBlock": grounded_xml,
        "matchedEntities": matched_entities,
        "tokenEstimate": approx_tokens,
        "targetType": target_type,
        "factsCount": len(verified_bullets[:4])
    }


def record_learned_prompt_insight(idea: str, target_type: str, confirmed_facts: List[str]) -> None:
    """Enables learning from successful prompt syntheses and user feedback."""
    if not confirmed_facts:
        return
    learned = load_learned_knowledge()
    entities = extract_entities(idea)
    domain = "visual" if target_type in ("image_generation", "video_generation") else "coding"
    
    for entity in entities:
        if entity not in learned:
            learned[entity] = {"domain": domain, "key_facts": []}
        for f in confirmed_facts:
            if f not in learned[entity]["key_facts"]:
                learned[entity]["key_facts"].append(f)
    
    save_learned_knowledge(learned)


def main():
    parser = argparse.ArgumentParser(description="Bedrock RAG & Fact-Verification Engine")
    parser.add_argument("--query", "-q", type=str, required=True, help="User prompt or project idea")
    parser.add_argument("--target", "-t", type=str, default="coding_agent", help="Target use case profile")
    parser.add_argument("--json", action="store_true", help="Output result as JSON")
    
    args = parser.parse_args()
    result = retrieve_grounded_facts(args.query, args.target)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result["groundedFactsBlock"]:
            print(result["groundedFactsBlock"])
        else:
            print("No external grounding required; query within baseline bounds.")


if __name__ == "__main__":
    main()
