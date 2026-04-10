import { jsPDF } from "jspdf";

export interface DadosAnamnese {
  id: string;
  medico_id: string;
  nome_paciente: string;
  idade_paciente: string;
  peso_paciente: number | null;
  altura_paciente: number | null;
  texto_bruto: string;
  queixa_principal: string | null;
  historico_clinico: string | null;
  medicamentos_em_uso: string[] | null;
  alergias: string | null;
  sinais_de_alerta: string[] | null;
  hipoteses_cid: string[] | null;
  hipotese_tratamento: {
    medicamentos_sugeridos: string[];
    exames_sugeridos: string[];
    condutas_imediatas: string[];
    aviso_legal: string;
  } | null;
  criado_em: string;
}

// ── Constantes de layout A4 ──────────────────────────────────────────────────

const PAGE_W = 210;       // mm
const PAGE_H = 297;       // mm
const MARGIN_X = 18;
const MARGIN_TOP = 22;
const MARGIN_BOTTOM = 30;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// Cores
const C_PRIMARY   = [28,  100, 242] as [number, number, number];
const C_DARK      = [30,   41,  59] as [number, number, number];
const C_MID       = [100, 116, 139] as [number, number, number];
const C_LIGHT_BG  = [241, 245, 249] as [number, number, number];
const C_RED_BG    = [254, 242, 242] as [number, number, number];
const C_RED_TEXT  = [185,  28,  28] as [number, number, number];
const C_WHITE     = [255, 255, 255] as [number, number, number];
const C_LINE      = [226, 232, 240] as [number, number, number];

// ── Funções auxiliares ───────────────────────────────────────────────────────

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Quebra um texto longo em linhas que cabem na largura dada (em mm). */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/** Desenha um retângulo arredondado preenchido (simulado com fillRect). */
function fillRoundRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, h, r, r, "F");
}

// ── Desenhadores de cada seção ───────────────────────────────────────────────

interface DrawCtx {
  doc: jsPDF;
  y: number;  // cursor Y atual
}

function addPage(ctx: DrawCtx) {
  ctx.doc.addPage();
  ctx.y = MARGIN_TOP;
  drawFooter(ctx.doc);
}

function ensureSpace(ctx: DrawCtx, needed: number) {
  if (ctx.y + needed > PAGE_H - MARGIN_BOTTOM) addPage(ctx);
}

function drawSectionTitle(ctx: DrawCtx, title: string) {
  const { doc } = ctx;
  ensureSpace(ctx, 14);
  doc.setFillColor(...C_PRIMARY);
  doc.rect(MARGIN_X, ctx.y, 3, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C_PRIMARY);
  doc.text(title.toUpperCase(), MARGIN_X + 6, ctx.y + 5);
  ctx.y += 10;
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, ctx.y, PAGE_W - MARGIN_X, ctx.y);
  ctx.y += 5;
}

function drawTextField(ctx: DrawCtx, label: string, value: string | null) {
  const { doc } = ctx;
  const text = value?.trim() || "Não identificado";
  const lines = wrapText(doc, text, CONTENT_W - 4);
  const blockH = 8 + lines.length * 5.5 + 6;

  ensureSpace(ctx, blockH);

  fillRoundRect(doc, MARGIN_X, ctx.y, CONTENT_W, blockH, 2, C_LIGHT_BG);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MID);
  doc.text(label.toUpperCase(), MARGIN_X + 4, ctx.y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...C_DARK);
  const textY = ctx.y + 12;
  lines.forEach((line: string, i: number) => {
    doc.text(line, MARGIN_X + 4, textY + i * 5.5);
  });

  ctx.y += blockH + 4;
}

function drawTagList(ctx: DrawCtx, label: string, items: string[] | null, isAlert = false) {
  const { doc } = ctx;
  const list = items?.filter(Boolean) ?? [];

  const bgColor  = isAlert ? C_RED_BG    : C_LIGHT_BG;
  const tagColor = isAlert ? C_RED_TEXT  : C_PRIMARY;

  ensureSpace(ctx, 24);

  // Cabeçalho do bloco
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MID);
  doc.text(label.toUpperCase(), MARGIN_X, ctx.y + 5);
  ctx.y += 9;

  if (list.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C_MID);
    doc.text("Nenhum item identificado", MARGIN_X, ctx.y + 4);
    ctx.y += 10;
    return;
  }

  // Desenha tags em linha, quebrando quando necessário
  const tagH = 7;
  const tagPadX = 4;
  const gap = 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  let curX = MARGIN_X;
  let rowStartY = ctx.y;

  for (const item of list) {
    const tw = (doc.getStringUnitWidth(item) * 8) / doc.internal.scaleFactor + tagPadX * 2;
    if (curX + tw > PAGE_W - MARGIN_X && curX > MARGIN_X) {
      curX = MARGIN_X;
      rowStartY += tagH + gap;
      ensureSpace(ctx, tagH + 4);
    }
    fillRoundRect(doc, curX, rowStartY, tw, tagH, 2, bgColor);
    doc.setTextColor(...tagColor);
    doc.text(item, curX + tagPadX, rowStartY + 5.2);
    curX += tw + gap;
  }

  ctx.y = rowStartY + tagH + 7;
}

function drawFooter(doc: jsPDF) {
  const sigY = PAGE_H - MARGIN_BOTTOM + 4;

  // Linha de assinatura
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.4);
  const sigX = PAGE_W / 2 - 40;
  doc.line(sigX, sigY + 16, sigX + 80, sigY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MID);
  doc.text("Assinatura e carimbo do médico responsável", PAGE_W / 2, sigY + 20, { align: "center" });

  // Número de página
  doc.setFontSize(7);
  doc.text(
    `Sistema de Anamnese — documento gerado automaticamente`,
    MARGIN_X,
    PAGE_H - 8
  );
}

// ── Exportação principal ─────────────────────────────────────────────────────

export function gerarPdfAnamnese(dados: DadosAnamnese) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  drawFooter(doc);

  const ctx: DrawCtx = { doc, y: MARGIN_TOP };

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  // Logo / nome do sistema
  fillRoundRect(doc, MARGIN_X, ctx.y, CONTENT_W, 20, 3, C_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C_WHITE);
  doc.text("Sistema de Anamnese", MARGIN_X + 6, ctx.y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(199, 220, 255);
  doc.text("Documento de Triagem Médica", MARGIN_X + 6, ctx.y + 14);
  ctx.y += 26;

  // Meta-informações
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C_MID);
  doc.text(`ID: ${dados.id}`, MARGIN_X, ctx.y);
  doc.text(`Emitido em: ${formatarData(dados.criado_em)}`, PAGE_W - MARGIN_X, ctx.y, { align: "right" });
  ctx.y += 10;

  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, ctx.y, PAGE_W - MARGIN_X, ctx.y);
  ctx.y += 8;

  // ── Seção: Dados do Paciente ───────────────────────────────────────────────
  drawSectionTitle(ctx, "Dados do Paciente");

  const pesoStr   = dados.peso_paciente   != null ? `${dados.peso_paciente} kg`  : "Não informado";
  const alturaStr = dados.altura_paciente != null ? `${dados.altura_paciente} cm` : "Não informado";

  // Grade 2×2: nome | idade / peso | altura
  const halfW = (CONTENT_W - 6) / 2;
  const cellH = 16;

  const drawPatientCell = (x: number, y: number, w: number, label: string, value: string) => {
    fillRoundRect(doc, x, y, w, cellH, 2, C_LIGHT_BG);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MID);
    doc.text(label.toUpperCase(), x + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C_DARK);
    doc.text(value, x + 4, y + 13);
  };

  ensureSpace(ctx, cellH * 2 + 10);
  drawPatientCell(MARGIN_X,              ctx.y, halfW, "Nome completo",        dados.nome_paciente);
  drawPatientCell(MARGIN_X + halfW + 6,  ctx.y, halfW, "Idade / Nascimento",   dados.idade_paciente);
  ctx.y += cellH + 4;
  drawPatientCell(MARGIN_X,              ctx.y, halfW, "Peso",   pesoStr);
  drawPatientCell(MARGIN_X + halfW + 6,  ctx.y, halfW, "Altura", alturaStr);
  ctx.y += cellH + 8;
  drawTextField(ctx, "Histórico clínico", dados.historico_clinico);
  drawTextField(ctx, "Alergias",          dados.alergias);

  // ── Seção: Medicamentos e Alertas ─────────────────────────────────────────
  ctx.y += 4;
  drawSectionTitle(ctx, "Medicamentos e Alertas");

  drawTagList(ctx, "Medicamentos em uso",  dados.medicamentos_em_uso);
  drawTagList(ctx, "Sinais de alerta",     dados.sinais_de_alerta, true);

  // ── Seção: Hipóteses Diagnósticas ─────────────────────────────────────────
  ctx.y += 4;
  drawSectionTitle(ctx, "Hipóteses Diagnósticas (CID-10)");

  drawTagList(ctx, "Hipóteses CID-10", dados.hipoteses_cid);

  // ── Seção: Hipótese de Tratamento ─────────────────────────────────────────
  if (dados.hipotese_tratamento) {
    const ht = dados.hipotese_tratamento;
    ctx.y += 4;
    drawSectionTitle(ctx, "Hipótese de Tratamento");

    drawTagList(ctx, "Medicamentos sugeridos", ht.medicamentos_sugeridos?.length ? ht.medicamentos_sugeridos : null);
    drawTagList(ctx, "Exames sugeridos",        ht.exames_sugeridos?.length       ? ht.exames_sugeridos       : null);

    if (ht.condutas_imediatas?.length) {
      const { doc } = ctx;
      ensureSpace(ctx, 14 + ht.condutas_imediatas.length * 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...C_MID);
      doc.text("CONDUTAS IMEDIATAS", MARGIN_X, ctx.y + 5);
      ctx.y += 9;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C_DARK);
      for (const conduta of ht.condutas_imediatas) {
        ensureSpace(ctx, 7);
        doc.text(`• ${conduta}`, MARGIN_X + 3, ctx.y + 5);
        ctx.y += 6;
      }
      ctx.y += 4;
    }

    if (ht.aviso_legal) {
      const { doc } = ctx;
      const avisoLines = wrapText(doc, `⚠  ${ht.aviso_legal}`, CONTENT_W - 10);
      const avisoH = avisoLines.length * 5 + 10;
      ensureSpace(ctx, avisoH);
      const C_YELLOW_BG   = [254, 252, 232] as [number, number, number];
      const C_YELLOW_TEXT = [113,  63,  18] as [number, number, number];
      fillRoundRect(doc, MARGIN_X, ctx.y, CONTENT_W, avisoH, 2, C_YELLOW_BG);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...C_YELLOW_TEXT);
      avisoLines.forEach((line: string, i: number) => {
        doc.text(line, MARGIN_X + 5, ctx.y + 7 + i * 5);
      });
      ctx.y += avisoH + 6;
    }
  }

  // ── Seção: Texto bruto ────────────────────────────────────────────────────
  ctx.y += 4;
  drawSectionTitle(ctx, "Relato Original da Consulta");

  const linhasBruto = wrapText(doc, dados.texto_bruto, CONTENT_W - 8);
  const brutoH = linhasBruto.length * 5 + 10;
  ensureSpace(ctx, Math.min(brutoH, 60));

  fillRoundRect(doc, MARGIN_X, ctx.y, CONTENT_W, Math.min(brutoH, PAGE_H - MARGIN_BOTTOM - ctx.y - 4), 2, C_LIGHT_BG);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C_MID);
  let by = ctx.y + 7;
  for (const linha of linhasBruto) {
    if (by > PAGE_H - MARGIN_BOTTOM - 6) {
      addPage(ctx);
      by = ctx.y;
    }
    doc.text(linha, MARGIN_X + 4, by);
    by += 5;
  }
  ctx.y = by + 4;

  // ── Salva ─────────────────────────────────────────────────────────────────
  const dataStr = new Date(dados.criado_em)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  doc.save(`anamnese_${dataStr}_${dados.id.slice(0, 8)}.pdf`);
}
