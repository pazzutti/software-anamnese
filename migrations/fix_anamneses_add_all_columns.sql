-- Migration: add missing columns to anamneses table.
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS medico_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS texto_bruto TEXT NOT NULL DEFAULT '';
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS queixa_principal TEXT;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS historico_clinico TEXT;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS medicamentos_em_uso JSONB;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS alergias TEXT;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS sinais_de_alerta JSONB;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS hipoteses_cid JSONB;
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.anamneses ALTER COLUMN medico_id DROP DEFAULT;
ALTER TABLE public.anamneses ALTER COLUMN texto_bruto DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_anamneses_medico_id ON public.anamneses (medico_id);

ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medico_own_rows" ON public.anamneses;
DROP POLICY IF EXISTS "Medico acessa suas anamneses" ON public.anamneses;

CREATE POLICY "medico_own_rows" ON public.anamneses
    FOR ALL
    USING (auth.uid() = medico_id);
