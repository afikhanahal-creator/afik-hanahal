-- A Meta lead's WhatsApp welcome reaches its CRM copy (contacts.crm_data.auto.sent.welcome), so the leads board can show the
-- green "welcome sent" mark (src/lib/leadFields.js welcomeState). The Meta pipeline marks meta_leads.wa_sent when the welcome
-- (automatic, or the Lead Center's first send) or any message of ours reached the lead; the CRM copy used to keep the state it
-- had when it was copied. Applied 2026-10-26.
create or replace function public.afik_meta_wa_sent_to_crm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.wa_sent is true and old.wa_sent is distinct from true then
    update public.contacts
       set crm_data = jsonb_set(coalesce(crm_data, '{}'::jsonb), '{auto}',
             coalesce(crm_data->'auto', '{}'::jsonb)
             || jsonb_build_object('sent', coalesce(crm_data->'auto'->'sent', '{}'::jsonb) || jsonb_build_object('welcome', to_jsonb(now()))))
     where crm_data->>'metaLeadId' = new.id::text
       and crm_data->'auto'->'sent'->>'welcome' is null;
  end if;
  return new;
end $$;

drop trigger if exists afik_meta_wa_sent_to_crm on public.meta_leads;
create trigger afik_meta_wa_sent_to_crm after update of wa_sent on public.meta_leads
  for each row execute function public.afik_meta_wa_sent_to_crm();

-- the copies made before: the welcome's own time from the log when there is one, else the lead's time
update public.contacts c
   set crm_data = jsonb_set(coalesce(c.crm_data, '{}'::jsonb), '{auto}',
         coalesce(c.crm_data->'auto', '{}'::jsonb)
         || jsonb_build_object('sent', coalesce(c.crm_data->'auto'->'sent', '{}'::jsonb) || jsonb_build_object('welcome', to_jsonb(coalesce(
              (select min(l.created_at) from public.automation_log l where l.lead_id = 'meta:' || m.id::text and l.rule_key = 'welcome' and l.ok),
              m.created_at)))))
  from public.meta_leads m
 where m.id::text = c.crm_data->>'metaLeadId'
   and m.wa_sent is true
   and c.crm_data->'auto'->'sent'->>'welcome' is null;
