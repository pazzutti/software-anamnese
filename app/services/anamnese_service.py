from uuid import UUID
from typing import List

from app.database import supabase
from app.schemas.anamnese import AnamneseCreate, AnamneseUpdate, AnamneseResponse
from app.services import groq_service

TABLE = "anamneses"


def criar_anamnese(payload: AnamneseCreate) -> AnamneseResponse:
    data = payload.model_dump(mode="json")

    # Preenche campos extraídos via IA somente se queixa_principal não foi informada
    if data.get("queixa_principal") is None:
        try:
            extraido = groq_service.processar_texto(payload.texto_bruto)
            extracted = extraido.model_dump(mode="json")
            for field, value in extracted.items():
                if data.get(field) is None:
                    data[field] = value
        except Exception:
            # Falha na extração não bloqueia a criação da anamnese
            pass

    response = supabase.table(TABLE).insert(data).execute()
    return AnamneseResponse(**response.data[0])


def listar_anamneses(medico_id: UUID | None = None) -> List[AnamneseResponse]:
    query = supabase.table(TABLE).select("*")
    if medico_id:
        query = query.eq("medico_id", str(medico_id))
    response = query.order("criado_em", desc=True).execute()
    return [AnamneseResponse(**row) for row in response.data]


def obter_anamnese(anamnese_id: UUID) -> AnamneseResponse | None:
    response = (
        supabase.table(TABLE).select("*").eq("id", str(anamnese_id)).maybe_single().execute()
    )
    if response.data is None:
        return None
    return AnamneseResponse(**response.data)


def atualizar_anamnese(anamnese_id: UUID, payload: AnamneseUpdate) -> AnamneseResponse | None:
    data = payload.model_dump(mode="json", exclude_none=True)
    if not data:
        return obter_anamnese(anamnese_id)
    response = (
        supabase.table(TABLE).update(data).eq("id", str(anamnese_id)).execute()
    )
    if not response.data:
        return None
    return AnamneseResponse(**response.data[0])


def deletar_anamnese(anamnese_id: UUID) -> bool:
    response = supabase.table(TABLE).delete().eq("id", str(anamnese_id)).execute()
    return len(response.data) > 0


def processar_anamnese(anamnese_id: UUID) -> AnamneseResponse:
    """
    (Re)processa o texto bruto de uma anamnese existente via Groq e persiste
    os dados extraídos. Levanta ValueError se o JSON retornado for inválido.
    """
    anamnese = obter_anamnese(anamnese_id)
    if anamnese is None:
        return None

    extraido = groq_service.processar_texto(anamnese.texto_bruto)

    update_data = extraido.model_dump(mode="json")
    response = (
        supabase.table(TABLE).update(update_data).eq("id", str(anamnese_id)).execute()
    )
    return AnamneseResponse(**response.data[0])
