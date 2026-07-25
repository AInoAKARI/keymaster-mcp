-- Preserve externally attributable Result Claim Audit telemetry in the existing
-- akari_agent_events ledger without weakening its device foreign key.
--
-- Root cause: ai-akari-result-auditor writes device_id="external-mcp:<client>".
-- akari_agent_events.device_id references akari_agent_devices, so the REST insert
-- was rejected before this trigger could create the corresponding telemetry-only
-- parent record. The Edge Function intentionally catches telemetry errors, which
-- made successful audit calls invisible in the usage ledger.
--
-- This trigger creates only telemetry-only device records. It does not grant an
-- authentication secret, change RLS, store claim/evidence text, or count a call
-- as third-party adoption by itself.

create or replace function public.ensure_external_mcp_agent_device()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if new.device_id like 'external-mcp:%' then
    v_hash :=
      md5(random()::text || clock_timestamp()::text || new.device_id) ||
      md5(new.device_id || random()::text || clock_timestamp()::text);

    insert into public.akari_agent_devices (
      device_id,
      secret_hash,
      label,
      platform,
      app_version,
      capabilities,
      last_status,
      last_seen_at,
      updated_at
    ) values (
      new.device_id,
      v_hash,
      'External MCP telemetry client',
      'external',
      'result-auditor/1',
      jsonb_build_object('telemetry_only', true),
      jsonb_build_object('last_event_type', new.event_type),
      now(),
      now()
    )
    on conflict (device_id) do update
      set last_seen_at = excluded.last_seen_at,
          updated_at = excluded.updated_at,
          last_status = jsonb_build_object('last_event_type', new.event_type);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_external_mcp_agent_device
  on public.akari_agent_events;

create trigger trg_ensure_external_mcp_agent_device
before insert on public.akari_agent_events
for each row
execute function public.ensure_external_mcp_agent_device();

-- Reproducible non-persistent verification:
-- begin;
-- set local role service_role;
-- insert into public.akari_agent_events(device_id, command_id, event_type, body)
-- values (
--   'external-mcp:internal-trigger-test',
--   null,
--   'internal_schema_test',
--   '{"internal_test":true}'::jsonb
-- );
-- rollback;
