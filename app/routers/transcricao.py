from fastapi import APIRouter, HTTPException, UploadFile, File, status

from app.schemas.transcricao import TranscricaoResponse
from app.services import whisper_service

router = APIRouter(prefix="/transcricao", tags=["Transcrição"])

TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post(
    "/",
    response_model=TranscricaoResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcrever áudio",
    description=(
        "Recebe um arquivo de áudio (mp3, wav, webm, ogg, flac, mp4) e retorna o "
        "texto transcrito usando Whisper localmente. O texto pode ser revisado antes "
        "de ser enviado para processamento pela IA da Groq."
    ),
)
async def transcrever(
    audio: UploadFile = File(..., description="Arquivo de áudio a ser transcrito"),
):
    conteudo = await audio.read()

    if len(conteudo) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo de áudio está vazio.",
        )

    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Arquivo muito grande. Tamanho máximo: {TAMANHO_MAXIMO_BYTES // (1024 * 1024)} MB.",
        )

    try:
        resultado = whisper_service.transcrever_audio(
            conteudo=conteudo,
            content_type=audio.content_type or "application/octet-stream",
            nome_arquivo=audio.filename or "audio.mp3",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return resultado
