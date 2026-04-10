-- Migration: adiciona campos de triagem médica à tabela existente.
-- Execute no SQL Editor do Supabase caso a tabela já exista.

ALTER TABLE public.anamneses
    ADD COLUMN IF NOT EXISTS historico_clinico   TEXT,
    ADD COLUMN IF NOT EXISTS medicamentos_em_uso JSONB,
    ADD COLUMN IF NOT EXISTS alergias            TEXT,
    ADD COLUMN IF NOT EXISTS sinais_de_alerta    JSONB,
    ADD COLUMN IF NOT EXISTS hipoteses_cid       JSONB;

-- Migra dados do campo antigo 'historico' (se existir) para 'historico_clinico'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'anamneses'
          AND column_name  = 'historico'
    ) THEN
        UPDATE public.anamneses
           SET historico_clinico = historico
         WHERE historico_clinico IS NULL AND historico IS NOT NULL;

        ALTER TABLE public.anamneses DROP COLUMN historico;
    END IF;
END $$;
