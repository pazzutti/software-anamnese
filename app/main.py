from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import anamneses, transcricao

app = FastAPI(
    title="Software de Anamnese",
    description="API para criação e gestão de anamneses médicas",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(anamneses.router, prefix="/api/v1")
app.include_router(transcricao.router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
