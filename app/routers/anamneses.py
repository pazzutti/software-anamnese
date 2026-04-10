from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import get_current_user_id
from app.schemas.anamnese import AnamneseCreate, AnamneseUpdate, AnamneseResponse
from app.services import anamnese_service

router = APIRouter(prefix="/anamneses", tags=["Anamneses"])


def _verificar_propriedade(anamnese: AnamneseResponse | None, user_id: UUID) -> AnamneseResponse:
    """Garante que a anamnese existe e pertence ao médico autenticado."""
    if anamnese is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anamnese não encontrada")
    if anamnese.medico_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado.")
    return anamnese


@router.post("/", response_model=AnamneseResponse, status_code=status.HTTP_201_CREATED)
def criar(
    payload: AnamneseCreate,
    user_id: UUID = Depends(get_current_user_id),
):
    # Garante que o medico_id do payload seja sempre o do token — impede spoofing
    payload.medico_id = user_id
    return anamnese_service.criar_anamnese(payload)


@router.get("/", response_model=List[AnamneseResponse])
def listar(user_id: UUID = Depends(get_current_user_id)):
    # Retorna apenas as anamneses do médico autenticado
    return anamnese_service.listar_anamneses(user_id)


@router.get("/{anamnese_id}", response_model=AnamneseResponse)
def obter(anamnese_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    anamnese = anamnese_service.obter_anamnese(anamnese_id)
    return _verificar_propriedade(anamnese, user_id)


@router.patch("/{anamnese_id}", response_model=AnamneseResponse)
def atualizar(
    anamnese_id: UUID,
    payload: AnamneseUpdate,
    user_id: UUID = Depends(get_current_user_id),
):
    anamnese = anamnese_service.obter_anamnese(anamnese_id)
    _verificar_propriedade(anamnese, user_id)
    atualizada = anamnese_service.atualizar_anamnese(anamnese_id, payload)
    if not atualizada:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anamnese não encontrada")
    return atualizada


@router.delete("/{anamnese_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar(anamnese_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    anamnese = anamnese_service.obter_anamnese(anamnese_id)
    _verificar_propriedade(anamnese, user_id)
    anamnese_service.deletar_anamnese(anamnese_id)


@router.post(
    "/{anamnese_id}/processar",
    response_model=AnamneseResponse,
    summary="Reprocessar texto via IA",
    description=(
        "Envia o texto bruto da anamnese para o modelo Groq (llama-3.3-70b-versatile) "
        "e atualiza os campos extraídos."
    ),
)
def processar(anamnese_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    anamnese = anamnese_service.obter_anamnese(anamnese_id)
    _verificar_propriedade(anamnese, user_id)
    try:
        return anamnese_service.processar_anamnese(anamnese_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

