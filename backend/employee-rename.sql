-- BARDAHL: при смене имени мастера история переносится на новое имя.
-- Уже применено в Supabase (migration rename_master_everywhere).
-- Заказы, журналы услуг/кругов и очередь хранят имя текстом, поэтому
-- функция атомарно переименовывает его во всех таблицах.

create or replace function public.bardahl_rename_master(p_user_id uuid, p_old text, p_new text, p_branch int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_orders int := 0; c_service int := 0; c_rounds int := 0; c_queue int := 0;
begin
  if p_old is null or p_new is null or btrim(p_new) = '' or p_old = p_new then
    return jsonb_build_object('orders',0,'service_log',0,'round_log',0,'queue',0);
  end if;

  update public.work_orders set master_name = p_new
   where user_id = p_user_id
      or (user_id is null and master_name = p_old and branch_id = p_branch);
  get diagnostics c_orders = row_count;

  update public.queue_service_log set master_name = p_new
   where user_id = p_user_id
      or (user_id is null and master_name = p_old and branch_id = p_branch);
  get diagnostics c_service = row_count;

  update public.queue_round_log set master_name = p_new
   where master_name = p_old and branch_id = p_branch;
  get diagnostics c_rounds = row_count;

  update public.queue_members set name = p_new where user_id = p_user_id;
  get diagnostics c_queue = row_count;

  return jsonb_build_object('orders',c_orders,'service_log',c_service,'round_log',c_rounds,'queue',c_queue);
end $$;

revoke all on function public.bardahl_rename_master(uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.bardahl_rename_master(uuid, text, text, int) to service_role;
