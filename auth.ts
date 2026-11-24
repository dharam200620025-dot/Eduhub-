import { supabaseServer } from "@/lib/supabase/server";
export async function requireUser() {
  const supabase = await supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  const { data, error } = await (await supabaseServer()).from("profiles").select("role").eq("id", user.id).single();
  if (error || data?.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}