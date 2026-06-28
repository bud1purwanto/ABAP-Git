from app.config import settings

PROMPT_TEMPLATE = """Task: Summarize the following unified diff of an SAP ABAP program{program_part}.
We need a highly detailed and informative Git commit message.

Strict Rules:
1. First line: Provide a clear, short title summarizing the main change (max 70 characters).
2. Blank line.
3. Next lines: Provide a detailed, informative bulleted list explaining exactly WHAT changed and WHY. Include specific variable names, logic changes, or function calls modified if applicable.
4. DO NOT include any markdown formatting blocks like ` ``` ` around the whole message.
5. DO NOT output any XML-like tags (like <thought>), internal thinking process, or introductory phrases. Output ONLY the final commit message string.

DIFF:
{diff}
"""


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
