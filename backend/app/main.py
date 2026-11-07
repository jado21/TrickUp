import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.exceptions import HTTPException

from app.api.routes import router
from app.api.upload_limits import SyllabusBodyLimitMiddleware
from app.api.mission_limits import MissionBodyLimitMiddleware
from app.config import load_settings
from app.schemas.common import ErrorBody, ErrorDetail, ErrorResponse
from app.services.errors import ServiceError
from app.services.gemini import GeminiService
from app.services.syllabus import SyllabusService
from app.services.missions import MissionService
from app.services.mission_store import MissionStore

app = FastAPI(title="TriKUp API", version="0.1.0", docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")
app.state.settings = load_settings()
app.state.syllabus_service = SyllabusService(GeminiService(app.state.settings))
app.state.mission_service = MissionService(app.state.syllabus_service.gemini, MissionStore())
app.add_middleware(SyllabusBodyLimitMiddleware)
app.add_middleware(MissionBodyLimitMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


def error_response(status: int, code: str, message: str, details: list[ErrorDetail] | None = None, headers=None):
    body = ErrorResponse(error=ErrorBody(code=code, message=message, details=details or []))
    return JSONResponse(status_code=status, content=body.model_dump(), headers=headers)


@app.exception_handler(ServiceError)
async def service_error(request: Request, exc: ServiceError):
    return error_response(exc.status, exc.code, exc.message)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 501: "NOT_IMPLEMENTED"}.get(exc.status_code, "HTTP_ERROR")
    return error_response(exc.status_code, code, str(exc.detail), headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    details = [ErrorDetail(field=".".join(map(str, item["loc"])), message=item["msg"]) for item in exc.errors()]
    return error_response(422, "VALIDATION_ERROR", "La solicitud no cumple el contrato.", details)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    logging.getLogger(__name__).error("Error no controlado (%s)", type(exc).__name__)
    return error_response(500, "INTERNAL_ERROR", "Error interno del servidor.")


app.include_router(router)


@app.get("/docs", include_in_schema=False)
async def docs_alias():
    return RedirectResponse("/api/docs")


@app.get("/openapi.json", include_in_schema=False)
async def openapi_alias():
    return RedirectResponse("/api/openapi.json")
