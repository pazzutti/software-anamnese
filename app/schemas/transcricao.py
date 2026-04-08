from pydantic import BaseModel, Field


class TranscricaoResponse(BaseModel):
    """Resposta da transcrição de áudio pelo Whisper."""

    texto_transcrito: str = Field(..., description="Texto transcrito do áudio")
    idioma_detectado: str = Field(..., description="Idioma detectado pelo Whisper (ex: 'pt', 'en')")
    duracao_segundos: float = Field(..., description="Duração do áudio em segundos")
