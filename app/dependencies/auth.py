"""
Dependência de autenticação via Supabase JWT.

Uso nos routers:
    from app.dependencies.auth import get_current_user_id

    @router.get("/")
    def listar(user_id: UUID = Depends(get_current_user_id)):
        ...
"""

from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from gotrue.errors import AuthApiError

from app.database import supabase

_bearer = HTTPBearer(auto_error=True)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> UUID:
    """
    Valida o Bearer Token do Supabase e devolve o UUID do usuário autenticado.

    Raises:
        HTTPException 401 — token ausente, expirado ou inválido.
    """
    token = credentials.credentials
    try:
        response = supabase.auth.get_user(token)
        user = response.user
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido ou expirado.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return UUID(str(user.id))
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Falha na autenticação: {exc.message}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erro interno na verificação do token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
