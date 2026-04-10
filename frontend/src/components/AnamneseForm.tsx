"use client";

import { useState, useRef, useEffect } from "react";
import { gerarPdfAnamnese } from "@/lib/gerarPdf";
import { createClient } from "@/lib/supabase/client";

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type Etapa = "entrada" | "revisao" | "resultado";

interface AnamneseResultado {
  id: string;
  medico_id: string;
  texto_bruto: string;
  queixa_principal: string | null;
  historico_clinico: string | null;
  medicamentos_em_uso: string[] | null;
  alergias: string | null;
  sinais_de_alerta: string[] | null;
  hipoteses_cid: string[] | null;
  criado_em: string;
}

interface Rascunho {
  queixa_principal: string;
  historico_clinico: string;
  medicamentos_em_uso: string[];
  alergias: string;
  sinais_de_alerta: string[];
  hipoteses_cid: string[];
}

function toRascunho(r: AnamneseResultado): Rascunho {
  return {
    queixa_principal: r.queixa_principal ?? "",
    historico_clinico: r.historico_clinico ?? "",
    medicamentos_em_uso: r.medicamentos_em_uso ?? [],
    alergias: r.alergias ?? "",
    sinais_de_alerta: r.sinais_de_alerta ?? [],
    hipoteses_cid: r.hipoteses_cid ?? [],
  };
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

  // Etapa 3 — resultado + edição
  const [resultado, setResultado] = useState<AnamneseResultado | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [privacidadeReforcada, setPrivacidadeReforcada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Gravação de áudio
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Skeleton — processamento da IA
  const [processandoIA, setProcessandoIA] = useState(false);

  // Para gravação ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stop();
    };
  }, []);

  // ── helpers de edição ─────────────────────────────────────────────────────

  function setTexto(field: keyof Pick<Rascunho, "queixa_principal" | "historico_clinico" | "alergias">, value: string) {
    setSalvo(false);
    setRascunho((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  function setLista(field: keyof Pick<Rascunho, "medicamentos_em_uso" | "sinais_de_alerta" | "hipoteses_cid">, value: string[]) {
    setSalvo(false);
    setRascunho((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  // ── Gravação de áudio ────────────────────────────────────────────────────

  async function iniciarGravacao() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "gravacao.webm", { type: "audio/webm" });
        setAudioFile(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setGravando(true);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => setTempoGravacao((t) => t + 1), 1000);
    } catch {
      setErro("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setGravando(false);
  }

  // ── Etapa 1 → 2 ──────────────────────────────────────────────────────────

  async function handleProximaEtapa() {
    setErro(null);

    if (modo === "texto") {
      if (!textoManual.trim()) { setErro("Cole ou digite o texto da consulta."); return; }
      setTextoRevisado(textoManual);
      setEtapa("revisao");
      return;
    }

    if (!audioFile) { setErro("Selecione um arquivo de áudio."); return; }

    setLoading(true);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("audio", audioFile);
      const res = await fetch(`${API_URL}/transcricao/`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
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

  // ── Etapa 2 → 3 ──────────────────────────────────────────────────────────

  async function handleGerarAnamnese() {
    if (!textoRevisado.trim()) { setErro("O texto não pode estar vazio."); return; }
    setErro(null);
    setProcessandoIA(true);
    setEtapa("resultado"); // mostra skeleton imediatamente
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/anamneses/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ medico_id: medicoId, texto_bruto: textoRevisado, privacidade_reforcada: privacidadeReforcada }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.detail ?? `Erro ${res.status}`);
      }
      const data: AnamneseResultado = await res.json();
      setResultado(data);
      setRascunho(toRascunho(data));
      setSalvo(false);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar a anamnese.");
      setEtapa("revisao"); // volta em caso de erro
    } finally {
      setProcessandoIA(false);
    }
  }

  // ── Confirmar e salvar edições ────────────────────────────────────────────

  async function handleConfirmarSalvar() {
    if (!resultado || !rascunho) return;
    setSalvando(true);
    setErro(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/anamneses/${resultado.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          queixa_principal: rascunho.queixa_principal || null,
          historico_clinico: rascunho.historico_clinico || null,
          medicamentos_em_uso: rascunho.medicamentos_em_uso.length > 0 ? rascunho.medicamentos_em_uso : null,
          alergias: rascunho.alergias || null,
          sinais_de_alerta: rascunho.sinais_de_alerta.length > 0 ? rascunho.sinais_de_alerta : null,
          hipoteses_cid: rascunho.hipoteses_cid.length > 0 ? rascunho.hipoteses_cid : null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.detail ?? `Erro ${res.status}`);
      }
      const atualizado: AnamneseResultado = await res.json();
      setResultado(atualizado);
      setRascunho(toRascunho(atualizado));
      setSalvo(true);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar as alterações.");
    } finally {
      setSalvando(false);
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
    setRascunho(null);
    setSalvo(false);
    setGerandoPdf(false);
    setProcessandoIA(false);
    setGravando(false);
    setTempoGravacao(0);
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setPrivacidadeReforcada(false);
    setErro(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── ETAPA 1: Entrada ── */}
      {etapa === "entrada" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
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
              <label className="text-sm font-medium text-slate-700">Texto da consulta</label>
              <textarea
                rows={8}
                value={textoManual}
                onChange={(e) => setTextoManual(e.target.value)}
                placeholder="Cole ou digite o relato da consulta médica aqui..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 bg-white resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Controles de gravação */}
              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
                {gravando ? (
                  <>
                    <WaveformAnimation />
                    <p className="text-sm font-semibold text-red-600 tabular-nums">
                      ⏺ {formatarTempo(tempoGravacao)}
                    </p>
                    <button
                      onClick={pararGravacao}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition"
                    >
                      ⏹ Parar gravação
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 border border-red-200">
                      <span className="text-2xl">🎙️</span>
                    </div>
                    <button
                      onClick={iniciarGravacao}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition"
                    >
                      ⏺ Iniciar gravação
                    </button>
                  </>
                )}
              </div>

              {/* Divisor */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">ou envie um arquivo</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Upload de arquivo */}
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,video/mp4,video/webm"
                onChange={(e) => { setAudioFile(e.target.files?.[0] ?? null); }}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 transition"
              />
              <p className="text-xs text-slate-400">Formatos aceitos: mp3, wav, webm, ogg, flac, mp4 (máx. 25 MB)</p>

              {/* Preview do arquivo selecionado/gravado */}
              {audioFile && !gravando && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 flex items-center gap-2">
                  <span className="text-green-600 text-sm">✓</span>
                  <span className="text-xs text-green-700 font-medium">{audioFile.name}</span>
                  <span className="text-xs text-green-500 ml-auto">
                    {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Privacidade Reforçada */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={privacidadeReforcada}
              onChange={(e) => setPrivacidadeReforcada(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">
              🔒 Privacidade Reforçada — remover dados identificadores antes de enviar para a IA
            </span>
          </label>

          {erro && <ErrorBox message={erro} />}

          <button
            onClick={handleProximaEtapa}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg py-2.5 text-sm transition"
          >
            {loading
              ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 align-middle" />Transcrevendo áudio...</>
              : modo === "texto" ? "Revisar texto →" : "Transcrever e revisar →"}
          </button>
        </div>
      )}

      {/* ── ETAPA 2: Revisão ── */}
      {etapa === "revisao" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-slate-800">Revisar texto</h3>
            <p className="text-sm text-slate-500 mt-0.5">Corrija o texto antes de enviar para a IA extrair os dados.</p>
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 bg-white resize-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
          />
          {erro && <ErrorBox message={erro} />}
          <div className="flex gap-3">
            <button onClick={reiniciar} className="flex-1 border border-slate-300 text-slate-600 hover:border-slate-400 rounded-lg py-2.5 text-sm transition">
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

      {/* ── ETAPA 3: Skeleton enquanto IA processa ── */}
      {etapa === "resultado" && processandoIA && <SkeletonAnamnese />}

      {/* ── ETAPA 3: Resultado editável ── */}
      {etapa === "resultado" && !processandoIA && resultado && rascunho && (
        <div className="space-y-4">
          {/* Banner */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">✅ Anamnese gerada — edite os campos e confirme</p>
              <p className="text-xs text-green-600 mt-0.5">ID: {resultado.id}</p>
            </div>
            {salvo && (
              <span className="text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded-full px-2.5 py-1">
                Salvo ✓
              </span>
            )}
          </div>

          {/* Cards editáveis — campos de texto */}
          <EditableTextCard
            label="Queixa principal"
            value={rascunho.queixa_principal}
            onChange={(v) => setTexto("queixa_principal", v)}
          />
          <EditableTextCard
            label="Histórico clínico"
            value={rascunho.historico_clinico}
            onChange={(v) => setTexto("historico_clinico", v)}
            multiline
          />
          <EditableTextCard
            label="Alergias"
            value={rascunho.alergias}
            onChange={(v) => setTexto("alergias", v)}
          />

          {/* Cards editáveis — listas */}
          <EditableListCard
            label="Medicamentos em uso"
            items={rascunho.medicamentos_em_uso}
            onChange={(v) => setLista("medicamentos_em_uso", v)}
            placeholder="Adicionar medicamento..."
          />
          <EditableListCard
            label="Sinais de alerta"
            items={rascunho.sinais_de_alerta}
            onChange={(v) => setLista("sinais_de_alerta", v)}
            placeholder="Adicionar sinal de alerta..."
            tagColor="red"
          />
          <EditableListCard
            label="Hipóteses CID-10"
            items={rascunho.hipoteses_cid}
            onChange={(v) => setLista("hipoteses_cid", v)}
            placeholder="Ex: J45: Asma"
            tagColor="blue"
          />

          {/* Texto bruto (somente leitura) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Texto bruto</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{resultado.texto_bruto}</p>
          </div>

          {erro && <ErrorBox message={erro} />}

          {/* Ações */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex gap-3">
              <button
                onClick={reiniciar}
                className="flex-1 border border-slate-300 text-slate-600 hover:border-slate-400 rounded-lg py-2.5 text-sm transition"
              >
                + Nova anamnese
              </button>
              <button
                onClick={handleConfirmarSalvar}
                disabled={salvando || salvo}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg py-2.5 text-sm transition"
              >
                {salvando ? "Salvando..." : salvo ? "Salvo ✓" : "Confirmar e salvar"}
              </button>
            </div>
            <button
              onClick={async () => {
                if (!resultado || !rascunho) return;
                setGerandoPdf(true);
                try {
                  await new Promise((r) => setTimeout(r, 50)); // permite re-render
                  gerarPdfAnamnese({ ...resultado, ...rascunho });
                } finally {
                  setGerandoPdf(false);
                }
              }}
              disabled={gerandoPdf}
              className="w-full flex items-center justify-center gap-2 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 disabled:border-blue-300 disabled:text-blue-300 font-medium rounded-lg py-2.5 text-sm transition"
            >
              {gerandoPdf ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0-3-3m3 3 3-3M4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5v-9a1.5 1.5 0 0 0-1.5-1.5h-3.75L15 4.5H9L7.25 7.5H4.5A1.5 1.5 0 0 0 3 9v9a1.5 1.5 0 0 0 1.5 1.5Z" />
                  </svg>
                  Gerar PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EditableTextCard ──────────────────────────────────────────────────────────

function EditableTextCard({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
        >
          {editing ? "Concluir" : "Editar"}
        </button>
      </div>

      {editing ? (
        multiline ? (
          <textarea
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-800 bg-white resize-none outline-none focus:ring-2 focus:ring-blue-100 transition"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-100 transition"
          />
        )
      ) : (
        <p className="text-sm text-slate-700 whitespace-pre-wrap min-h-[1.25rem]">
          {value.trim() || <span className="italic text-slate-400">Não identificado</span>}
        </p>
      )}
    </div>
  );
}

// ── EditableListCard ──────────────────────────────────────────────────────────

type TagColor = "slate" | "red" | "blue";

const tagStyles: Record<TagColor, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  red:   "bg-red-50 text-red-700 border-red-200",
  blue:  "bg-blue-50 text-blue-700 border-blue-200",
};

function EditableListCard({
  label,
  items,
  onChange,
  placeholder,
  tagColor = "slate",
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  tagColor?: TagColor;
}) {
  const [editing, setEditing] = useState(false);
  const [novo, setNovo] = useState("");

  function remover(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function adicionar() {
    const trimmed = novo.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setNovo("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); adicionar(); }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
        >
          {editing ? "Concluir" : "Editar"}
        </button>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <li
              key={i}
              className={`flex items-center gap-1.5 text-xs border rounded-full px-3 py-1 ${tagStyles[tagColor]}`}
            >
              {item}
              {editing && (
                <button
                  onClick={() => remover(i)}
                  className="ml-0.5 text-current opacity-50 hover:opacity-100 font-bold leading-none"
                  aria-label="Remover"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-slate-400">Nenhum item identificado</p>
      )}

      {editing && (
        <div className="flex gap-2">
          <input
            type="text"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-100 transition"
          />
          <button
            onClick={adicionar}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function formatarTempo(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

// ── WaveformAnimation ─────────────────────────────────────────────────────────

function WaveformAnimation() {
  const heights = [12, 20, 28, 36, 28, 20, 12, 20, 28, 36];
  const delays  = [0, 0.1, 0.2, 0.3, 0.2, 0.1, 0, 0.15, 0.25, 0.35];
  return (
    <>
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.25); }
          50%       { transform: scaleY(1); }
        }
        .wave-bar {
          animation: wave 0.8s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
      <div className="flex items-center justify-center gap-0.5" style={{ height: 40 }}>
        {heights.map((h, i) => (
          <div
            key={i}
            className="wave-bar w-1.5 rounded-full bg-red-500"
            style={{ height: h, animationDelay: `${delays[i]}s` }}
          />
        ))}
      </div>
    </>
  );
}

// ── SkeletonAnamnese ──────────────────────────────────────────────────────────

function SkeletonAnamnese() {
  return (
    <div className="space-y-4">
      {/* banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3 animate-pulse">
        <div className="w-5 h-5 rounded-full bg-blue-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-blue-200 rounded w-2/3" />
          <div className="h-3 bg-blue-100 rounded w-1/3" />
        </div>
      </div>
      {/* cards */}
      {[{ w: "w-1/4", lines: 1 }, { w: "w-1/3", lines: 2 }, { w: "w-1/5", lines: 1 }, { w: "w-1/4", lines: 0 }, { w: "w-1/3", lines: 0 }, { w: "w-2/5", lines: 0 }].map(({ w, lines }, i) => (
        <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3 animate-pulse">
          <div className={`h-3 bg-slate-200 rounded ${w}`} />
          <div className="h-4 bg-slate-100 rounded w-full" />
          {lines >= 2 && <div className="h-4 bg-slate-100 rounded w-3/4" />}
          {lines === 0 && (
            <div className="flex gap-2">
              <div className="h-6 bg-slate-100 rounded-full w-20" />
              <div className="h-6 bg-slate-100 rounded-full w-24" />
              <div className="h-6 bg-slate-100 rounded-full w-16" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── ErrorBox ──────────────────────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {message}
    </p>
  );
}
