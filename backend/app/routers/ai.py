from fastapi import APIRouter, HTTPException

from app.schemas import GenerateCommitRequest, GenerateCommitResponse
from app.services import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/generate-commit", response_model=GenerateCommitResponse)
def generate_commit(payload: GenerateCommitRequest):
    try:
        message = ai_service.generate_commit_message(payload.diff, payload.program_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {exc}") from exc
    return GenerateCommitResponse(commit_message=message)
