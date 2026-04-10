-- Execute este script no SQL Editor do Supabase para criar a tabela de anamneses

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.anamneses (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    medico_id           UUID        NOT NULL,
    texto_bruto         TEXT        NOT NULL,
    queixa_principal    TEXT,
    historico_clinico   TEXT,
    medicamentos_em_uso JSONB,
    alergias            TEXT,
    sinais_de_alerta    JSONB,
    hipoteses_cid       JSONB,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para buscas por médico
CREATE INDEX IF NOT EXISTS idx_anamneses_medico_id ON public.anamneses (medico_id);

-- Row Level Security (recomendado no Supabase)
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;

-- Política: apenas usuários autenticados acessam seus próprios registros.
CREATE POLICY "Médico acessa suas anamneses" ON public.anamneses
    FOR ALL
    USING (auth.uid() = medico_id);
