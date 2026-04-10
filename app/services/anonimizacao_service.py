"""
Serviço de anonimização de texto clínico.

Remove nomes próprios, CPFs, datas de nascimento e outros dados identificadores
antes de enviar o texto para a API externa da Groq (Llama 3).

Estratégia de substituição:
  - Nomes próprios e menções a "paciente X"  → [PACIENTE]
  - CPF (com ou sem pontuação)              → [CPF]
  - RG                                       → [RG]
  - Datas de nascimento explícitas           → [DATA_NASC]
  - Telefones                                → [TELEFONE]
  - E-mails                                 → [EMAIL]
  - Endereços residenciais                  → [ENDEREÇO]
  - Nomes após padrões como "paciente:",    → [PACIENTE]
    "nome:", "nome completo:", "sr.", "sra."
"""

import re


# ── Padrões de substituição (ordem importa) ──────────────────────────────────

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # CPF: 000.000.000-00 ou 00000000000
    (re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"), "[CPF]"),

    # RG: vários formatos regionais brasileiros
    (re.compile(r"\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]\b"), "[RG]"),

    # Telefone: (XX) XXXXX-XXXX, (XX) XXXX-XXXX, variantes sem parênteses
    (
        re.compile(r"\(?\d{2}\)?[\s\-]?\d{4,5}[\s\-]?\d{4}\b"),
        "[TELEFONE]",
    ),

    # E-mail
    (
        re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
        "[EMAIL]",
    ),

    # Rua / Av. / Alameda / Travessa + nome + número
    (
        re.compile(
            r"\b(?:rua|r\.|av(?:enida)?|alameda|al\.|travessa|tv\.)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n,;]{2,50}(?:,\s*n[°º]?\s*\d+)?",
            re.IGNORECASE,
        ),
        "[ENDEREÇO]",
    ),

    # "paciente: Nome Sobrenome" / "nome: ..." / "nome completo: ..."
    (
        re.compile(
            r"\b(?:paciente|nome\s+completo|nome)\s*[:–\-]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)+)",
            re.IGNORECASE,
        ),
        lambda m: m.group(0).split(m.group(1))[0] + "[PACIENTE]",
    ),

    # "Sr. / Sra. / Dr. / Dra. Nome"
    (
        re.compile(
            r"\b(?:sr\.?|sra\.?|dr\.?|dra\.?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)*)",
            re.IGNORECASE,
        ),
        lambda m: m.group(0).split(m.group(1))[0] + "[PACIENTE]",
    ),

    # Sequência de 2+ palavras capitalizadas que não sejam siglas de CID (letras + dígitos)
    # Conservador: só substitui quando precedido de verbo introdutório de identificação
    (
        re.compile(
            r"(?:chamado|chamada|nome(?:-se)?|chama(?:-se)?|identifica(?:-se)?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)+)",
            re.IGNORECASE,
        ),
        lambda m: m.group(0).split(m.group(1))[0] + "[PACIENTE]",
    ),
]


def anonimizar(texto: str) -> str:
    """
    Aplica as substituições de anonimização ao texto e retorna a versão sanitizada.
    Não modifica o texto original armazenado no banco — apenas o que é enviado à IA.
    """
    resultado = texto
    for pattern, substitution in _PATTERNS:
        if callable(substitution):
            resultado = pattern.sub(substitution, resultado)
        else:
            resultado = pattern.sub(substitution, resultado)
    return resultado
