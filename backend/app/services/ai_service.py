from app.config import settings

PROMPT_TEMPLATE = """You are a senior ABAP developer writing a concise, professional Git commit message.
Summarize the following diff of an SAP ABAP program{program_part}. Focus on WHAT changed and WHY if evident.
Keep it to one short title line, optionally followed by a brief bullet list. Do not include markdown code fences.

DIFF:
{diff}
"""


def _build_prompt(diff: str, program_name: str | None) -> str:
    program_part = f" '{program_name}'" if program_name else ""
    return PROMPT_TEMPLATE.format(program_part=program_part, diff=diff)


def _generate_with_gemini(prompt: str) -> str:
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    return response.text.strip()


def _generate_with_anthropic(prompt: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


def _generate_with_openrouter(prompt: str) -> str:
    import httpx

    response = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.OPENROUTER_MODEL,
            "max_tokens": 300,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


def generate_commit_message(diff: str, program_name: str | None = None) -> str:
    if not diff.strip():
        return "No changes detected."

    prompt = _build_prompt(diff, program_name)

    if settings.AI_PROVIDER == "anthropic":
        return _generate_with_anthropic(prompt)
    elif settings.AI_PROVIDER == "openrouter":
        return _generate_with_openrouter(prompt)
    return _generate_with_gemini(prompt)
