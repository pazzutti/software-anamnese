from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional


class DadosExtraidos(BaseModel):
    """Dados clínicos extraídos pelo modelo de IA a partir do texto bruto."""

    queixa_principal: Optional[str] = None
    historico: Optional[str] = None


class AnamneseCreate(BaseModel):
    """Payload para criar uma nova anamnese."""

    medico_id: UUID = Field(..., description="UUID do médico responsável")
    texto_bruto: str = Field(..., min_length=1, description="Texto livre digitado pelo médico")
    queixa_principal: Optional[str] = Field(None, description="Queixa principal identificada")
    historico: Optional[str] = Field(None, description="Histórico clínico relevante")


class AnamneseUpdate(BaseModel):
    """Payload para atualização parcial de uma anamnese."""

    texto_bruto: Optional[str] = Field(None, min_length=1)
    queixa_principal: Optional[str] = None
    historico: Optional[str] = None


class AnamneseResponse(BaseModel):
    """Representação completa de uma anamnese retornada pela API."""

    id: UUID
    medico_id: UUID
    texto_bruto: str
    queixa_principal: Optional[str]
    historico: Optional[str]
    criado_em: datetime

    model_config = {"from_attributes": True}
