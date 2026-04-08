"use client";

import { useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type Etapa = "entrada" | "revisao" | "resultado";

interface AnamneseResultado {
  id: string;
  queixa_principal: string | null;
  historico: string | null;
  texto_bruto: string;
  criado_em: string;
}

export default function AnamneseForm({ medicoId }: { medicoId: string }) {
  const [etapa, setEtapa] = useState<Etapa>("entrada");
  const [modo, setModo] = useState<"texto" | "audio">("texto");

  // Etapa 1 — entrada
  const [textoManual, setTextoManual] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Etapa 2 — revisão
  const [textoRevisado, setTextoRevisado] = useState("");
  const [idioma, setIdioma] = useState("");
  const [duracao, setDuracao] = useState<number | null>(null);

  // Etapa 3 — resultado
  const [resultado, setResultado] = useState<AnamneseResultado | null>(null);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Etapa 1 → 2: transcrição ou passe direto ──────────────────────────────

  async function handleProximaEtapa() {
    setErro(null);

    if (modo === "texto") {
      if (!textoManual.trim()) {
        setErro("Cole ou digite o texto da consulta.");
        return;
      }
      setTextoRevisado(textoManual);
      setEtapa("revisao");
      return;
    }

    // Modo áudio: chamar endpoint de transcrição
    if (!audioFile) {
      setErro("Selecione um arquivo de áudio.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioFile);

      const res = await fetch(`${API_URL}/transcricao/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.detail ?? `Erro ${res.status}`);
      }

      const data = await res.json();
      setTextoRevisado(data.texto_transcrito);
      setIdioma(data.idioma_detectado);
      setDuracao(data.duracao_segundos);
      setEtapa("revisao");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao transcrever o áudio.");
    } finally {
      setLoading(false);
    }
  }

  // ── Etapa 2 → 3: gerar anamnese ──────────────────────────────────────────

  async function handleGerarAnamnese() {
    if (!textoRevisado.trim()) {
      setErro("O texto não pode estar vazio.");
      return;
    }

    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/anamneses/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medico_id: medicoId,
          texto_bruto: textoRevisado,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.detail ?? `Erro ${res.status}`);
      }

      const data: AnamneseResultado = await res.json();
      setResultado(data);
      setEtapa("resultado");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar a anamnese.");
    } finally {
      setLoading(false);
    }
  }

  // ── Reiniciar ─────────────────────────────────────────────────────────────

  function reiniciar() {
    setEtapa("entrada");
    setModo("texto");
    setTextoManual("");
    setAudioFile(null);
    setTextoRevisado("");
    setIdioma("");
    setDuracao(null);
    setResultado(null);
    setErro(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── ETAPA 1: Entrada ── */}
      {etapa === "entrada" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          {/* Seletor de modo */}
          <div className="flex gap-2">
            {(["texto", "audio"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setModo(m); setErro(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  modo === m
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                }`}
              >
                {m === "texto" ? "✏️ Texto" : "🎙️ Áudio"}
              </button>
            ))}
          </div>

          {modo === "texto" ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Texto da consulta
              </label>
              <textarea
                rows={8}
                value={textoManual}
                onChange={(e) => setTextoManual(e.target.value)}
                placeholder="Cole ou digite o relato da consulta médica aqui..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Arquivo de áudio
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,video/mp4,video/webm"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 transition"
              />
              <p className="text-xs text-slate-400">
                Formatos aceitos: mp3, wav, webm, ogg, flac, mp4 (máx. 25 MB)
              </p>
              {audioFile && (
                <p className="text-xs text-slate-500">
                  Arquivo selecionado: <span className="font-medium">{audioFile.name}</span>{" "}
                  ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          )}

          {erro && <ErrorBox message={erro} />}

          <button
            onClick={handleProximaEtapa}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg py-2.5 text-sm transition"
          >
            {loading
              ? "Transcrevendo áudio..."
              : modo === "texto"
              ? "Revisar texto →"
              : "Transcrever e revisar →"}
          </button>
        </div>
      )}

      {/* ── ETAPA 2: Revisão ── */}
      {etapa === "revisao" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-slate-800">Revisar texto</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Corrija o texto antes de enviar para a IA extrair os dados.
            </p>
            {idioma && (
              <p className="text-xs text-slate-400 mt-1">
                Idioma detectado: <span className="font-medium">{idioma}</span>
                {duracao !== null && ` · Duração: ${duracao}s`}
              </p>
            )}
          </div>

          <textarea
            rows={10}
            value={textoRevisado}
            onChange={(e) => setTextoRevisado(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
          />

          {erro && <ErrorBox message={erro} />}

          <div className="flex gap-3">
            <button
              onClick={reiniciar}
              className="flex-1 border border-slate-300 text-slate-600 hover:border-slate-400 rounded-lg py-2.5 text-sm transition"
            >
              ← Voltar
            </button>
            <button
              onClick={handleGerarAnamnese}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg py-2.5 text-sm transition"
            >
              {loading ? "Gerando anamnese..." : "Gerar anamnese ✨"}
            </button>
          </div>
        </div>
      )}

      {/* ── ETAPA 3: Resultado ── */}
      {etapa === "resultado" && resultado && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <p className="text-sm font-medium text-green-800">
              ✅ Anamnese gerada com sucesso!
            </p>
            <p className="text-xs text-green-600 mt-0.5">ID: {resultado.id}</p>
          </div>

          <ResultCard label="Queixa principal" value={resultado.queixa_principal} />
          <ResultCard label="Histórico clínico" value={resultado.historico} />

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Texto bruto
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{resultado.texto_bruto}</p>
          </div>

          <button
            onClick={reiniciar}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 text-sm transition"
          >
            + Nova anamnese
          </button>
        </div>
      )}
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-700">
        {value ?? <span className="italic text-slate-400">Não identificado</span>}
      </p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {message}
    </p>
  );
}
