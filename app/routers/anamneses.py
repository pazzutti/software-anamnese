from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.anamnese import AnamneseCreate, AnamneseUpdate, AnamneseResponse
from app.services import anamnese_service

router = APIRouter(prefix="/anamneses", tags=["Anamneses"])


@router.post("/", response_model=AnamneseResponse, status_code=status.HTTP_201_CREATED)
def criar(payload: AnamneseCreate):
    return anamnese_service.criar_anamnese(payload)


@router.get("/", response_model=List[AnamneseResponse])
def listar(medico_id: Optional[UUID] = Query(None, description="Filtrar por médico")):
    return anamnese_service.listar_anamneses(medico_id)


@router.get("/{anamnese_id}", response_model=AnamneseResponse)
def obter(anamnese_id: UUID):
    anamnese = anamnese_service.obter_anamnese(anamnese_id)
    if not anamnese:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anamnese não encontrada")
    return anamnese


@router.patch("/{anamnese_id}", response_model=AnamneseResponse)
def atualizar(anamnese_id: UUID, payload: AnamneseUpdate):
    anamnese = anamnese_service.atualizar_anamnese(anamnese_id, payload)
    if not anamnese:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anamnese não encontrada")
    return anamnese


@router.delete("/{anamnese_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar(anamnese_id: UUID):
    removido = anamnese_service.deletar_anamnese(anamnese_id)
    if not removido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anamnese não encontrada")


@router.post(
    "/{anamnese_id}/processar",
    response_model=AnamneseResponse,
    summary="Reprocessar texto via IA",
    description=(
        "Envia o texto bruto da anamnese para o modelo Groq (llama-3.3-70b-versatile) "
        "e atualiza os campos 'queixa_principal' e 'historico' com os dados extraídos."
    ),
)
def processar(anamnese_id: UUID):
    try:
        anamnese = anamnese_service.processar_anamnese(anamnese_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    if not anamnese:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anamnese não encontrada")

    return anamnese
