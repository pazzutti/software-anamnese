-- Migration: add hipotese_tratamento column to anamneses table.
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.anamneses ADD COLUMN IF NOT EXISTS hipotese_tratamento JSONB;
