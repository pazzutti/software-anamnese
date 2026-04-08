import json
import logging
import re

from groq import Groq

from app.config import settings
from app.schemas.anamnese import DadosExtraidos

logger = logging.getLogger(__name__)

_client = Groq(api_key=settings.groq_api_key)

MODELO = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """\
Você é um assistente médico especializado em estruturar dados clínicos.
Ao receber um texto bruto de consulta, extraia as informações e retorne \
APENAS um objeto JSON puro — sem markdown, sem blocos de código, sem texto antes ou depois.

O JSON deve ter EXATAMENTE as seguintes chaves:
{
  "queixa_principal": "<string com a queixa principal do paciente ou null>",
  "historico": "<string com histórico clínico relevante, doenças pregressas, medicamentos em uso, alergias ou null>"
}

Regras:
- Não inclua explicações, comentários ou qualquer texto fora do JSON.
- Se uma informação não estiver presente no texto, use null para o valor.
- Escreva sempre em português.
"""


def _extrair_json_da_resposta(texto: str) -> dict:
    """
    Tenta extrair um objeto JSON válido da resposta do modelo.
    Remove possíveis cercas de markdown (```json ... ```) caso o modelo as inclua
    mesmo sendo instruído a não fazê-lo.
    """
    texto = texto.strip()

    # Remove bloco de código markdown se presente
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", texto, re.DOTALL)
    if match:
        texto = match.group(1)

    # Tenta encontrar o primeiro objeto JSON no texto
    match = re.search(r"\{.*\}", texto, re.DOTALL)
    if match:
        texto = match.group(0)

    return json.loads(texto)


def processar_texto(texto_bruto: str) -> DadosExtraidos:
    """
    Envia o texto bruto da consulta para o modelo Groq e retorna os dados
    médicos extraídos como um objeto DadosExtraidos.

    Raises:
        ValueError: quando a resposta não contém JSON válido após tentativas de correção.
        groq.APIError: em caso de falha na chamada à API.
    """
    resposta = _client.chat.completions.create(
        model=MODELO,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": texto_bruto},
        ],
        temperature=0.2,
        max_tokens=512,
    )

    conteudo = resposta.choices[0].message.content or ""
    logger.debug("Resposta bruta do Groq: %s", conteudo)

    try:
        dados = _extrair_json_da_resposta(conteudo)
    except (json.JSONDecodeError, AttributeError) as exc:
        logger.error("JSON malformado recebido do Groq. Conteúdo: %r. Erro: %s", conteudo, exc)
        raise ValueError(
            f"A IA retornou uma resposta em formato inválido. Conteúdo recebido: {conteudo!r}"
        ) from exc

    return DadosExtraidos.model_validate(dados)
