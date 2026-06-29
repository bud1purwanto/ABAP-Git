from app.config import settings

PROMPT_TEMPLATE = """Task: Analyze the unified diff of the SAP ABAP program{program_part} and generate a professional Git commit message.

FORMAT REQUIREMENTS (Strictly follow this exact structure):
[Short title summarizing the main change (max 50 chars)]

- [Detailed bullet point 1 explaining WHAT changed and WHY]
- [Detailed bullet point 2 (if applicable)]

CRITICAL RULES:
1. DO NOT wrap the output in markdown code blocks (```).
2. DO NOT output raw diff chunks (like @@ -...).
3. DO NOT output any conversational text, introductory phrases, or thought processes. Output ONLY the raw commit message text itself.

DIFF:
{diff}
"""

def _clean_response(text: str) -> str:
    import re
    # Remove <thought> blocks
    text = re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL)
    # Remove markdown code blocks if the AI ignored instructions
    text = re.sub(r"```[a-zA-Z]*\n", "", text)
    text = re.sub(r"```\s*$", "", text)
    # Remove weird conversational artifacts like "Here is the commit message:"
    text = re.sub(r"^(Here is|This is)[\s\S]*?:\n+", "", text, flags=re.IGNORECASE)
    return text.strip()


def _build_prompt(diff: str, program_name: str | None) -> str:
    program_part = f" '{program_name}'" if program_name else ""
    return PROMPT_TEMPLATE.format(program_part=program_part, diff=diff)


def _generate_with_gemini(prompt: str) -> str:
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        "gemini-1.5-flash",
        system_instruction="You are an expert SAP ABAP developer. You must output ONLY the final Git commit message. No markdown, no thoughts, no intro."
    )
    response = model.generate_content(prompt)
    return _clean_response(response.text)


def _generate_with_anthropic(prompt: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return _clean_response(message.content[0].text)


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
    return _clean_response(data["choices"][0]["message"]["content"])


def generate_commit_message(diff: str, program_name: str | None = None) -> str:
    if not diff.strip():
        return "No changes detected."

    prompt = _build_prompt(diff, program_name)

    if settings.AI_PROVIDER == "anthropic":
        return _generate_with_anthropic(prompt)
    elif settings.AI_PROVIDER == "openrouter":
        return _generate_with_openrouter(prompt)
    return _generate_with_gemini(prompt)
