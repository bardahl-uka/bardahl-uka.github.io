-- BARDAHL: редактирование сотрудников и сброс пароля.
-- Выполните один раз в Supabase -> SQL Editor.
-- Расширяет список действий в журнале; данные не затрагиваются.

alter table public.employee_audit_log
  drop constraint if exists employee_audit_log_action_check;

alter table public.employee_audit_log
  add constraint employee_audit_log_action_check
  check (action in ('create','block','unblock','delete','update','reset_password'));
