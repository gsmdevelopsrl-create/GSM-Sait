import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { initials } from "@/lib/constants";
import { isTranscribeEnabled } from "@/lib/openai/transcribe";
import type { Ticket } from "@/lib/types";

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, position, phone, role, company_id, companies(name)")
    .eq("id", user.id)
    .single();

  const p = profile as {
    role?: "client" | "admin";
    full_name?: string | null;
    position?: string | null;
    phone?: string | null;
    companies?: { name: string } | { name: string }[] | null;
  } | null;
  const role = p?.role ?? "client";
  const companyName = one<{ name: string }>(p?.companies ?? null)?.name ?? "—";
  const fullName = p?.full_name ?? "Пользователь";
  const position = p?.position ?? "";
  const phone = p?.phone ?? "";

  const { data: raw } = await supabase
    .from("tickets")
    .select(
      `id, title, category, priority, status, description, deadline, estimate, rejection_reason, assignee, source, created_at, company_id, author_id,
       companies(name),
       author:profiles!tickets_author_id_fkey(full_name, telegram_username),
       ticket_attachments(id, ticket_id, type, name, url, storage_path, size_bytes),
       ticket_comments(id, ticket_id, author_name, is_client, body, created_at)`
    )
    .order("created_at", { ascending: false });

  const tickets: Ticket[] = ((raw ?? []) as unknown as Record<string, unknown>[]).map(
    (t) => ({
      ...(t as unknown as Ticket),
      company: one<{ name: string }>(t.companies as never),
      author: one<{
        full_name: string | null;
        telegram_username?: string | null;
      }>(t.author as never),
    })
  );

  // Список компаний: админ видит все (RLS), клиент — только свою.
  const { data: companiesRaw } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");
  const companies = (companiesRaw ?? []) as { id: string; name: string }[];

  // Сотрудники (профили): админ видит все, клиент — только себя (RLS).
  const { data: membersRaw } = await supabase
    .from("profiles")
    .select("id, full_name, position, phone, telegram_username, role, company_id");
  const members = (membersRaw ?? []) as {
    id: string;
    full_name: string | null;
    position: string | null;
    phone: string | null;
    telegram_username: string | null;
    role: string;
    company_id: string | null;
  }[];

  return (
    <Dashboard
      role={role}
      me={{
        id: user.id,
        name: fullName,
        company: role === "admin" ? "GSM Developer SRL" : companyName,
        realCompany: companyName === "—" ? "" : companyName,
        position,
        phone,
        ini: role === "admin" ? "GS" : initials(fullName),
        email: user.email ?? "—",
      }}
      tickets={tickets}
      companies={companies}
      members={members}
      voiceEnabled={isTranscribeEnabled()}
    />
  );
}
