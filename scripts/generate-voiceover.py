import asyncio
import edge_tts
import os

VOICE = "en-US-ChristopherNeural"  # Deep, authoritative, commanding voice
PITCH = "-5Hz"  # Sub-bass pitch shift for a heavy trailer voice
RATE = "+8%"  # Calibrated for snappy delivery fitting exactly 60 seconds

ACTS = [
    {
        "id": "act1_genesis",
        "text": "Engineering AI prompts isn't guess work anymore. It is software architecture. But today, prompts decay, models drift, and production systems break silently.",
        "start_sec": 1.2,
    },
    {
        "id": "act2_workstation",
        "text": "Meet Bedrock. The premier engineering workstation built for frontier intelligence. Ten frontier models. Zero lock-in. Real-time telemetry.",
        "start_sec": 10.5,
    },
    {
        "id": "act3_synthesis",
        "text": "From zero-shot to production-grade directives in milliseconds. Multi-pass reasoning, strict schema validation, and zero-coding archetypes.",
        "start_sec": 21.0,
    },
    {
        "id": "act4_branching",
        "text": "Architect complex agentic reasoning on an infinite DAG canvas. Branch workflows, run parallel evaluations, and prune dead paths with sub-millisecond tactile physics.",
        "start_sec": 31.0,
    },
    {
        "id": "act5_arena",
        "text": "Pit frontier LLMs head-to-head in the Arena. Then export hardened system directives across fifteen production frameworks.",
        "start_sec": 42.5,
    },
    {
        "id": "act6_finale",
        "text": "Stop guessing. Start engineering. Bedrock. The bedrock of intelligent software.",
        "start_sec": 52.5,
    }
]

async def generate():
    os.makedirs("public/audio/voiceover", exist_ok=True)
    full_text = " ".join([act["text"] for act in ACTS])
    
    print("Generating master narration...")
    cmd = [
        "edge-tts",
        "--voice", VOICE,
        "--pitch", PITCH,
        "--rate", RATE,
        "--text", full_text,
        "--write-media", "public/audio/voiceover/master_narration.mp3",
        "--write-subtitles", "public/audio/voiceover/master_narration.vtt"
    ]
    subprocess.run(cmd, check=True)
    print("Master narration saved.")

    for act in ACTS:
        print(f"Generating {act['id']}...")
        cmd = [
            "edge-tts",
            "--voice", VOICE,
            "--pitch", PITCH,
            "--rate", RATE,
            "--text", act["text"],
            "--write-media", f"public/audio/voiceover/{act['id']}.mp3",
            "--write-subtitles", f"public/audio/voiceover/{act['id']}.vtt"
        ]
        subprocess.run(cmd, check=True)
        print(f"Saved {act['id']}.mp3 and .vtt")

if __name__ == "__main__":
    import subprocess
    asyncio.run(generate())

