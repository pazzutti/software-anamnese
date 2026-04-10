from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from typing import List, Optional


class DadosExtraidos(BaseModel):
    """Dados clínicos extraídos pelo modelo de IA a partir do texto bruto."""

    queixa_principal: Optional[str] = None
    historico_clinico: Optional[str] = None
    medicamentos_em_uso: Optional[List[str]] = None
    alergias: Optional[str] = None
    sinais_de_alerta: Optional[List[str]] = None
    hipoteses_cid: Optional[List[str]] = None


class AnamneseCreate(BaseModel):
    """Payload para criar uma nova anamnese."""

    medico_id: UUID = Field(..., description="UUID do médico responsável")
    texto_bruto: str = Field(..., min_length=1, description="Texto livre digitado pelo médico")
    queixa_principal: Optional[str] = Field(None, description="Queixa principal identificada")
    historico_clinico: Optional[str] = Field(None, description="Histórico clínico relevante")
    medicamentos_em_uso: Optional[List[str]] = Field(None, description="Lista de medicamentos em uso")
    alergias: Optional[str] = Field(None, description="Alergias conhecidas")
    sinais_de_alerta: Optional[List[str]] = Field(None, description="Red flags identificados")
    hipoteses_cid: Optional[List[str]] = Field(None, description="Sugestões de códigos CID-10")
    privacidade_reforcada: bool = Field(
        False,
        description="Se True, remove dados identificadores antes de enviar o texto para a IA",
    )


class AnamneseUpdate(BaseModel):
    """Payload para atualização parcial de uma anamnese."""

    texto_bruto: Optional[str] = Field(None, min_length=1)
    queixa_principal: Optional[str] = None
    historico_clinico: Optional[str] = None
    medicamentos_em_uso: Optional[List[str]] = None
    alergias: Optional[str] = None
    sinais_de_alerta: Optional[List[str]] = None
    hipoteses_cid: Optional[List[str]] = None


class AnamneseResponse(BaseModel):
    """Representação completa de uma anamnese retornada pela API."""

    id: UUID
    medico_id: UUID
    texto_bruto: str
    queixa_principal: Optional[str]
    historico_clinico: Optional[str]
    medicamentos_em_uso: Optional[List[str]]
    alergias: Optional[str]
    sinais_de_alerta: Optional[List[str]]
    hipoteses_cid: Optional[List[str]]
    criado_em: datetime

    model_config = {"from_attributes": True}
