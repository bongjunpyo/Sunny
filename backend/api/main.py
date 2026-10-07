"""로컬 Uvicorn과 Vercel이 사용하는 FastAPI 진입점."""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


def create_app() -> FastAPI:
    app = FastAPI(
        title="Sunny API",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )

    @app.get("/api/health", tags=["operations"])
    async def health() -> dict[str, str]:
        # 프로세스 확인만 한다. DB/CMS 연결 성공을 뜻하지 않는다.
        return {"status": "ok"}

    @app.exception_handler(HTTPException)
    async def http_error(_request, exc: HTTPException) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": code, "message": str(exc.detail)}},
            headers=exc.headers,
        )

    return app


app = create_app()
