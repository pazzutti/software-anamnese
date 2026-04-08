import logging
import tempfile
import os
from pathlib import Path

from faster_whisper import WhisperModel

from app.schemas.transcricao import TranscricaoResponse

logger = logging.getLogger(__name__)

# Formatos de áudio aceitos
FORMATOS_ACEITOS = {
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
    "audio/flac",
    "video/mp4",
    "video/webm",
    "application/octet-stream",  # fallback genérico
}

# Modelo carregado uma única vez na inicialização do processo.
# device="cpu" + compute_type="int8" garante compatibilidade sem GPU.
logger.info("Carregando modelo Whisper 'base'...")
_modelo = WhisperModel("base", device="cpu", compute_type="int8")
logger.info("Modelo Whisper 'base' carregado com sucesso.")


def transcrever_audio(conteudo: bytes, content_type: str, nome_arquivo: str) -> TranscricaoResponse:
    """
    Transcreve o áudio recebido como bytes usando faster-whisper localmente.

    Args:
        conteudo: bytes brutos do arquivo de áudio.
        content_type: MIME type informado pelo cliente.
        nome_arquivo: nome original do arquivo (usado para inferir extensão).

    Returns:
        TranscricaoResponse com texto, idioma e duração.

    Raises:
        ValueError: se o formato de áudio não for suportado.
        RuntimeError: se a transcrição falhar.
    """
    if content_type not in FORMATOS_ACEITOS:
        raise ValueError(
            f"Formato de áudio não suportado: '{content_type}'. "
            f"Formatos aceitos: {sorted(FORMATOS_ACEITOS)}"
        )

    extensao = Path(nome_arquivo).suffix.lower() or ".mp3"

    with tempfile.NamedTemporaryFile(suffix=extensao, delete=False) as tmp:
        tmp.write(conteudo)
        caminho_tmp = tmp.name

    try:
        logger.debug("Transcrevendo arquivo temporário: %s", caminho_tmp)
        segmentos, info = _modelo.transcribe(caminho_tmp, beam_size=5)
        # faster-whisper retorna um gerador — materializa para obter o texto completo
        lista_segmentos = list(segmentos)
    except Exception as exc:
        logger.error("Erro ao transcrever áudio: %s", exc)
        raise RuntimeError(f"Falha na transcrição do áudio: {exc}") from exc
    finally:
        os.unlink(caminho_tmp)

    texto = " ".join(seg.text.strip() for seg in lista_segmentos).strip()
    idioma = info.language or "desconhecido"
    duracao = lista_segmentos[-1].end if lista_segmentos else 0.0

    return TranscricaoResponse(
        texto_transcrito=texto,
        idioma_detectado=idioma,
        duracao_segundos=round(duracao, 2),
    )
