import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import AnamneseForm from "@/components/AnamneseForm";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Sistema de Anamnese</h1>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-slate-600 hover:text-red-600 border border-slate-300 hover:border-red-300 rounded-lg px-3 py-1.5 transition"
          >
            Sair
          </button>
        </form>
      </header>

      {/* Conteúdo */}
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Nova Anamnese</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Cole o texto da consulta ou envie um áudio. O texto pode ser revisado antes de gerar a anamnese.
          </p>
        </div>

        <AnamneseForm medicoId={user.id} />
      </main>
    </div>
  );
}
