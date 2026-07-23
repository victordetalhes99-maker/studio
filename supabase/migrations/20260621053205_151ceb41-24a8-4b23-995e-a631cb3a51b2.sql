
-- Remove agendamento antigo
SELECT cron.unschedule('backup-to-sheets-5d');

-- Novo: toda quarta-feira (3) às 03:00 UTC
SELECT cron.schedule(
  'backup-to-sheets-weekly',
  '0 3 * * 3',
  $cron$
  SELECT net.http_post(
    url := 'https://ueawihyrvrjtqmtlrysz.supabase.co/functions/v1/backup-to-sheets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (SELECT value FROM public.app_config WHERE key = 'cron_token')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
