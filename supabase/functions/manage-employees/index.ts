import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function envKey(name: string, jsonName: string) {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  const raw = Deno.env.get(jsonName);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return parsed.default || "";
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Метод не поддерживается" });

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const publishableKey = envKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
    const secretKey = envKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!url || !publishableKey || !secretKey || !token) {
      return reply(500, { error: "Сервер управления сотрудниками не настроен" });
    }

    const callerClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) return reply(401, { error: "Требуется повторный вход" });

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: actor, error: actorError } = await admin
      .from("user_profiles")
      .select("user_id, role, is_active, deleted_at")
      .eq("user_id", callerData.user.id)
      .maybeSingle();

    if (actorError || !actor || actor.role !== "leader" || actor.is_active !== true || actor.deleted_at) {
      return reply(403, { error: "Управлять сотрудниками может только действующий руководитель" });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "list") {
      const { data, error } = await admin
        .from("user_profiles")
        .select("user_id,email,display_name,role,branch_id,is_active,deleted_at,created_at")
        .eq("role", "master")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return reply(200, { employees: data || [] });
    }

    if (action === "create") {
      const display_name = String(body.display_name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const branch_id = Number(body.branch_id);
      if (display_name.length < 2 || display_name.length > 100) {
        return reply(400, { error: "Укажите имя сотрудника (2–100 символов)" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return reply(400, { error: "Проверьте электронную почту" });
      }
      if (password.length < 10 || password.length > 128) {
        return reply(400, { error: "Временный пароль должен содержать от 10 до 128 символов" });
      }
      if (![1, 2].includes(branch_id)) return reply(400, { error: "Выберите действующий филиал" });

      const { data: branch, error: branchError } = await admin
        .from("branches").select("id").eq("id", branch_id).maybeSingle();
      if (branchError || !branch) return reply(400, { error: "Выбранный филиал не найден" });

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        return reply(400, { error: createError?.message || "Не удалось создать учётную запись" });
      }

      const { error: profileError } = await admin.from("user_profiles").insert({
        user_id: created.user.id,
        email,
        display_name,
        role: "master",
        must_change_password: body.must_change_password !== false,
        branch_id,
        queue_branch_id: branch_id,
        is_active: true,
        deleted_at: null,
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return reply(500, { error: "Учётная запись создана не полностью: " + profileError.message });
      }

      await admin.from("employee_audit_log").insert({
        actor_user_id: actor.user_id,
        target_user_id: created.user.id,
        action: "create",
        details: { email, display_name, branch_id, role: "master" },
      });
      return reply(200, { ok: true, user_id: created.user.id });
    }

    const targetId = String(body.user_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
      return reply(400, { error: "Не выбран сотрудник" });
    }

    const { data: target, error: targetError } = await admin
      .from("user_profiles")
      .select("user_id,role,is_active,deleted_at,display_name,email,branch_id")
      .eq("user_id", targetId)
      .maybeSingle();
    if (targetError || !target || target.role !== "master") {
      return reply(404, { error: "Сотрудник не найден" });
    }

    if (action === "update") {
      if (target.deleted_at) return reply(400, { error: "Архивированного сотрудника нельзя редактировать" });
      const display_name = String(body.display_name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const branch_id = Number(body.branch_id);
      const password = String(body.password || "");
      if (display_name.length < 2 || display_name.length > 100) {
        return reply(400, { error: "Укажите фамилию и имя сотрудника (2–100 символов)" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return reply(400, { error: "Проверьте электронную почту" });
      }
      if (![1, 2].includes(branch_id)) return reply(400, { error: "Выберите действующий филиал" });
      if (password && (password.length < 10 || password.length > 128)) {
        return reply(400, { error: "Пароль должен содержать от 10 до 128 символов" });
      }

      const { data: branch, error: branchError } = await admin
        .from("branches").select("id").eq("id", branch_id).maybeSingle();
      if (branchError || !branch) return reply(400, { error: "Выбранный филиал не найден" });

      const nameChanged = display_name !== String(target.display_name || "");
      if (nameChanged) {
        const { data: sameName, error: sameError } = await admin
          .from("user_profiles").select("user_id")
          .eq("role", "master").eq("branch_id", branch_id).is("deleted_at", null)
          .ilike("display_name", display_name.replace(/[\\%_]/g, "\\$&"))
          .neq("user_id", targetId).limit(1);
        if (sameError) throw sameError;
        if (sameName && sameName.length) {
          return reply(400, { error: "В этом филиале уже есть сотрудник с таким именем" });
        }
      }

      const emailChanged = email !== String(target.email || "").toLowerCase();
      if (emailChanged || password) {
        const authChanges: Record<string, unknown> = {};
        if (emailChanged) { authChanges.email = email; authChanges.email_confirm = true; }
        if (password) authChanges.password = password;
        const { error: authError } = await admin.auth.admin.updateUserById(targetId, authChanges);
        if (authError) return reply(400, { error: authError.message || "Не удалось изменить учётную запись" });
      }

      // The name is the key of history in orders/queue logs: carry the history over to the new name.
      let renamed: Record<string, number> | null = null;
      if (nameChanged) {
        const { data: renameResult, error: renameError } = await admin.rpc("bardahl_rename_master", {
          p_user_id: targetId,
          p_old: String(target.display_name || ""),
          p_new: display_name,
          p_branch: Number(target.branch_id),
        });
        if (renameError) {
          if (emailChanged) await admin.auth.admin.updateUserById(targetId, { email: String(target.email || ""), email_confirm: true });
          throw renameError;
        }
        renamed = renameResult as Record<string, number>;
      }

      const profileChanges: Record<string, unknown> = { display_name, email, branch_id, queue_branch_id: branch_id };
      if (password) profileChanges.must_change_password = body.must_change_password !== false;
      const { error: profileError } = await admin.from("user_profiles")
        .update(profileChanges).eq("user_id", targetId).is("deleted_at", null);
      if (profileError) {
        if (nameChanged) {
          await admin.rpc("bardahl_rename_master", {
            p_user_id: targetId,
            p_old: display_name,
            p_new: String(target.display_name || ""),
            p_branch: Number(target.branch_id),
          });
        }
        if (emailChanged) await admin.auth.admin.updateUserById(targetId, { email: String(target.email || ""), email_confirm: true });
        throw profileError;
      }

      await admin.from("employee_audit_log").insert({
        actor_user_id: actor.user_id,
        target_user_id: targetId,
        action: "update",
        details: {
          display_name, email, branch_id, password_changed: Boolean(password),
          ...(nameChanged ? { old_display_name: target.display_name, renamed } : {}),
        },
      });
      return reply(200, { ok: true, renamed });
    }

    if (action === "reset_password") {
      if (target.deleted_at) return reply(400, { error: "Архивированному сотруднику нельзя сбросить пароль" });
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
      const { error: pwError } = await admin.auth.admin.updateUserById(targetId, { password });
      if (pwError) throw pwError;
      const { error } = await admin.from("user_profiles")
        .update({ must_change_password: true }).eq("user_id", targetId);
      if (error) throw error;
      await admin.from("employee_audit_log").insert({
        actor_user_id: actor.user_id,
        target_user_id: targetId,
        action: "reset_password",
        details: { display_name: target.display_name },
      });
      return reply(200, { ok: true, password });
    }

    if (action === "block") {
      const { error: banError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
      if (banError) throw banError;
      const { error } = await admin.from("user_profiles")
        .update({ is_active: false }).eq("user_id", targetId).is("deleted_at", null);
      if (error) {
        await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
        throw error;
      }
      // Remove only the live queue slot; historical service logs and work orders remain untouched.
      const { error: queueError } = await admin.from("queue_members").delete().eq("user_id", targetId);
      if (queueError) console.error("Could not clear blocked employee queue slot", queueError);
    } else if (action === "unblock") {
      if (target.deleted_at) return reply(400, { error: "Архивированного сотрудника нельзя разблокировать" });
      const { error: unbanError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
      if (unbanError) throw unbanError;
      const { error } = await admin.from("user_profiles")
        .update({ is_active: true }).eq("user_id", targetId).is("deleted_at", null);
      if (error) {
        await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
        throw error;
      }
    } else if (action === "delete") {
      const { error: banError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
      if (banError) throw banError;
      const { error } = await admin.from("user_profiles")
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq("user_id", targetId).is("deleted_at", null);
      if (error) {
        await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
        throw error;
      }
      // Archive the employee's active queue slot without deleting any historical records.
      const { error: queueError } = await admin.from("queue_members").delete().eq("user_id", targetId);
      if (queueError) console.error("Could not clear archived employee queue slot", queueError);
    } else {
      return reply(400, { error: "Неизвестное действие" });
    }

    await admin.from("employee_audit_log").insert({
      actor_user_id: actor.user_id,
      target_user_id: targetId,
      action,
      details: { display_name: target.display_name },
    });
    return reply(200, { ok: true });
  } catch (error) {
    console.error("manage-employees error", error);
    return reply(500, { error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" });
  }
});
