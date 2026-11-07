from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.schemas.common import ErrorResponse, HealthResponse
from app.schemas.learning import RoadmapRequest, RoadmapResponse, SyllabusResponse
from app.schemas.missions import AnswerRequest, FeedbackResponse, MissionRequest, MissionResponse
from app.schemas.planner import PlannerRequest, PlannerResponse
from app.services.errors import ServiceError

router = APIRouter(prefix="/api", responses={422: {"model": ErrorResponse}})
PENDING_RESPONSE = {501: {"model": ErrorResponse}}


def pending() -> None:
    raise HTTPException(status_code=501, detail="Funcionalidad pendiente de implementación en la siguiente fase.")


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health():
    return HealthResponse()


@router.post("/syllabus/analyze", response_model=SyllabusResponse, tags=["syllabus"], responses={
    status: {"model": ErrorResponse} for status in (408, 413, 415, 429, 502, 503, 504)
})
async def analyze_syllabus(request: Request, file: Annotated[UploadFile, File(description="Sílabo PDF con texto; máximo 5 MiB y 40 páginas. Sin OCR.")]):
    form = await request.form()
    if len(form.multi_items()) != 1 or set(form.keys()) != {"file"}:
        await form.close()
        raise ServiceError(422, "VALIDATION_ERROR", "Envía únicamente un archivo en el campo file.")
    return await request.app.state.syllabus_service.analyze(file)


MISSION_ERRORS = {status: {"model": ErrorResponse} for status in (404, 409, 410, 413, 429, 500, 502, 503, 504)}


@router.post("/missions/generate", response_model=MissionResponse, tags=["missions"], responses=MISSION_ERRORS)
async def generate_mission(request: Request, body: MissionRequest):
    return await request.app.state.mission_service.generate(body)


@router.post("/missions/answer", response_model=FeedbackResponse, tags=["missions"], responses=MISSION_ERRORS)
async def answer_mission(request: Request, body: AnswerRequest):
    return request.app.state.mission_service.answer(body)


@router.get("/missions/{mission_id}", response_model=MissionResponse, tags=["missions"], responses=MISSION_ERRORS)
async def get_mission(request: Request, mission_id: str):
    return request.app.state.mission_service.get(mission_id)


@router.post("/roadmaps/generate", response_model=RoadmapResponse, tags=["roadmaps"], responses=PENDING_RESPONSE)
async def generate_roadmap(request: RoadmapRequest):
    pending()


@router.post("/planner/generate", response_model=PlannerResponse, tags=["planner"], responses=PENDING_RESPONSE)
async def generate_planner(request: PlannerRequest):
    pending()
