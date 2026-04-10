-- Migration: add patient identification fields to anamneses table.
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS nome_paciente TEXT NOT NULL DEFAULT '';
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS idade_paciente TEXT NOT NULL DEFAULT '';
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS peso_paciente NUMERIC(5,2);
ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS altura_paciente INTEGER;

-- Remove temporary defaults (existing rows will keep empty string; new rows must supply values)
ALTER TABLE public.anamneses ALTER COLUMN nome_paciente DROP DEFAULT;
ALTER TABLE public.anamneses ALTER COLUMN idade_paciente DROP DEFAULT;
