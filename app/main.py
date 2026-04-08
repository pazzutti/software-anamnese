from fastapi import FastAPI
from app.routers import anamneses

app = FastAPI(
    title="Software de Anamnese",
    description="API para criação e gestão de anamneses médicas",
    version="0.1.0",
)

app.include_router(anamneses.router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
