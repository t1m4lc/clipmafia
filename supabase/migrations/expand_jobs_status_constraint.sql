-- 1. Mettre à jour les lignes avec des statuts non reconnus par la nouvelle contrainte
UPDATE public.jobs
SET status = 'failed',
    error_message = 'Status migrated from legacy value'
WHERE status NOT IN (
  'queued','extracting_audio','transcribing','detecting_segments',
  'processing_video','burning_subtitles','uploading','completed','failed'
);

-- 2. Supprimer l'ancienne contrainte
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- 3. Ajouter la nouvelle contrainte étendue
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status = ANY (ARRAY[
    'queued'::text,
    'extracting_audio'::text,
    'transcribing'::text,
    'detecting_segments'::text,
    'processing_video'::text,
    'burning_subtitles'::text,
    'uploading'::text,
    'completed'::text,
    'failed'::text
  ]));