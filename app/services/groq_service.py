import json
import logging
import re

from groq import Groq
from json_repair import repair_json

from app.config import settings
from app.schemas.anamnese import DadosExtraidos

logger = logging.getLogger(__name__)

_client = Groq(api_key=settings.groq_api_key)

MODELO = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """\
Você é um Assistente de Triagem Médica especializado em estruturar dados clínicos a partir de relatos de consulta.
Ao receber um texto bruto, extraia as informações e retorne APENAS um objeto JSON puro — sem markdown, sem blocos de código, sem texto antes ou depois.

O JSON deve ter EXATAMENTE as seguintes chaves:
{
  "queixa_principal": "<string com a queixa principal do paciente, ou null>",
  "historico_clinico": "<string com doenças pregressas, cirurgias, internações relevantes, ou null>",
  "medicamentos_em_uso": ["<medicamento 1>", "<medicamento 2>"],
  "alergias": "<string descrevendo alergias conhecidas, ou null>",
  "sinais_de_alerta": ["<red flag 1>", "<red flag 2>"],
  "hipoteses_cid": ["<CID-10 código: descrição>", "<CID-10 código: descrição>"]
}

Regras:
- Não inclua explicações, comentários ou qualquer texto fora do JSON.
- Para campos do tipo lista sem dados identificados, use [] (lista vazia).
- Para campos de texto sem dados identificados, use null.
- Em 'sinais_de_alerta', liste apenas achados que exigem atenção imediata (ex: dor torácica, dispneia súbita, alteração de consciência).
- Em 'hipoteses_cid', sugira de 1 a 3 códigos CID-10 plausíveis com base nos sintomas descritos, no formato "X00: Descrição".
- Escreva sempre em português.
"""

RETRY_USER_MESSAGE = (
    "Sua resposta anterior não é um JSON válido. "
    "Retorne APENAS o objeto JSON correto, sem nenhum texto adicional."
)


def _limpar_texto(texto: str) -> str:
    """Remove cercas de markdown e extrai o primeiro objeto JSON encontrado."""
    texto = texto.strip()
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", texto, re.DOTALL)
    if match:
        return match.group(1)
    match = re.search(r"\{.*\}", texto, re.DOTALL)
    if match:
        return match.group(0)
    return texto


def _tentar_parse(texto: str) -> dict:
    """
    Tenta converter o texto em dict JSON.
    Estratégia 1: parse direto após limpeza.
    Estratégia 2: reparo via json_repair.
    Levanta json.JSONDecodeError se ambas falharem.
    """
    texto_limpo = _limpar_texto(texto)

    try:
        return json.loads(texto_limpo)
    except json.JSONDecodeError:
        pass

    # Fallback: json_repair
    try:
        reparado = repair_json(texto_limpo, return_objects=True)
        if isinstance(reparado, dict):
            logger.warning("JSON reparado via json_repair.")
            return reparado
    except Exception:
        pass

    raise json.JSONDecodeError("Não foi possível reparar o JSON", texto_limpo, 0)


def processar_texto(texto_bruto: str) -> DadosExtraidos:
    """
    Envia o texto bruto para o modelo Groq e retorna os dados clínicos extraídos.

    Fluxo de fallback:
      1. Chamada normal → parse direto → json_repair.
      2. Se ainda inválido, nova chamada pedindo correção → parse direto → json_repair.
      3. Se ainda inválido, levanta ValueError.

    Raises:
        ValueError: quando o JSON não pode ser recuperado após duas tentativas.
        groq.APIError: em caso de falha na chamada à API.
    """
    mensagens = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": texto_bruto},
    ]

    resposta = _client.chat.completions.create(
        model=MODELO,
        messages=mensagens,
        temperature=0.2,
        max_tokens=1024,
    )

    conteudo = resposta.choices[0].message.content or ""
    logger.debug("Resposta bruta do Groq: %s", conteudo)

    try:
        dados = _tentar_parse(conteudo)
    except json.JSONDecodeError:
        # Fallback: nova chamada pedindo ao modelo para corrigir a própria resposta
        logger.warning("JSON inválido na primeira tentativa. Executando retry no Groq.")
        mensagens_retry = mensagens + [
            {"role": "assistant", "content": conteudo},
            {"role": "user", "content": RETRY_USER_MESSAGE},
        ]
        resposta_retry = _client.chat.completions.create(
            model=MODELO,
            messages=mensagens_retry,
            temperature=0.0,
            max_tokens=1024,
        )
        conteudo_retry = resposta_retry.choices[0].message.content or ""
        logger.debug("Resposta de retry do Groq: %s", conteudo_retry)

        try:
            dados = _tentar_parse(conteudo_retry)
        except json.JSONDecodeError as exc:
            logger.error(
                "JSON inválido após retry. Conteúdo: %r. Erro: %s", conteudo_retry, exc
            )
            raise ValueError(
                f"A IA retornou formato inválido após duas tentativas. "
                f"Conteúdo: {conteudo_retry!r}"
            ) from exc

    return DadosExtraidos.model_validate(dados)
