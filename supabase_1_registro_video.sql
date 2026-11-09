-- =====================================================================
-- 5AFM2627 · REGISTRO DELLE VISUALIZZAZIONI DEI VIDEO
-- Da eseguire UNA SOLA VOLTA in Supabase:
--   progetto qjrqoznrpkawhlttfmyk → SQL Editor → New query →
--   incolla tutto questo file → Run
-- Si può rieseguire senza perdere i dati (crea solo ciò che manca
-- e aggiorna le funzioni).
--
-- Cosa registra, per ogni studente e ogni video:
--   play / pausa / salto (da dove a dove) / fine video / uscita dalla pagina
--   e, mentre il video scorre, un segnale ogni 15 secondi con i secondi
--   realmente guardati.
-- L'insegnante non viene registrata.
-- =====================================================================

create table if not exists public.ci_video_events (
  id        bigint generated always as identity primary key,
  student   int  not null check (student between 1 and 99),
  video     text not null,
  session   uuid not null,                 -- una "visione" = un'apertura della pagina
  kind      text not null check (kind in ('play','pause','seek','progress','ended','close')),
  pos       real not null,                 -- posizione nel video, in secondi
  from_pos  real,                          -- solo per i salti: punto di partenza
  watched   real not null default 0,       -- secondi guardati dall'evento precedente
  dur       real,                          -- durata del video, in secondi
  at        timestamptz not null default now()
);
create index if not exists ci_video_events_student_video on public.ci_video_events (student, video, at);
create index if not exists ci_video_events_session on public.ci_video_events (session, at);

-- Nessun accesso diretto alla tabella: si passa solo dalle funzioni qui sotto.
alter table public.ci_video_events enable row level security;
revoke all on public.ci_video_events from anon, authenticated;

-- ---------------------------------------------------------------------
-- Profilo di chi chiama (riusa ci_me, già usata dall'area giochi)
-- ---------------------------------------------------------------------
create or replace function public.ci_video_profile()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Accesso richiesto' using errcode = '28000';
  end if;
  return to_jsonb(public.ci_me());
end $$;

-- ---------------------------------------------------------------------
-- Lo studente invia un evento del video
-- ---------------------------------------------------------------------
create or replace function public.ci_video_event(
  p_video text, p_session uuid, p_kind text, p_pos real,
  p_dur real default null, p_watched real default 0, p_from real default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me jsonb := public.ci_video_profile();
  s  int;
begin
  if me->>'role' is distinct from 'student' then
    return;                                         -- insegnante: non si registra
  end if;
  s := (me->>'student')::int;
  if p_video !~ '^[a-z0-9_-]{1,40}$'
     or p_kind not in ('play','pause','seek','progress','ended','close') then
    raise exception 'Evento non valido' using errcode = '22023';
  end if;
  -- freno contro invii anomali: al massimo 40 eventi al minuto per studente
  if (select count(*) from ci_video_events
      where student = s and at > now() - interval '1 minute') >= 40 then
    return;
  end if;
  insert into ci_video_events (student, video, session, kind, pos, from_pos, watched, dur)
  values (s, p_video, p_session, p_kind,
          least(greatest(coalesce(p_pos, 0), 0), 36000),
          case when p_from is not null then least(greatest(p_from, 0), 36000) end,
          least(greatest(coalesce(p_watched, 0), 0), 120),
          case when p_dur > 0 and p_dur < 36000 then p_dur end);
end $$;

-- ---------------------------------------------------------------------
-- Riepilogo per l'insegnante
--   righe:  uno per studente e video
--   minuti: per ogni video e ogni blocco di 30 secondi, quanti studenti
--           lo hanno guardato (serve per vedere dove si smette di guardare)
-- ---------------------------------------------------------------------
create or replace function public.ci_video_report()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me  jsonb := public.ci_video_profile();
  out jsonb;
begin
  if me->>'role' is distinct from 'teacher' then
    raise exception 'Riservato all''insegnante' using errcode = '42501';
  end if;

  with
  blocchi as (                -- blocchi di 30 s effettivamente guardati
    select distinct e.student, e.video, b
    from ci_video_events e,
         generate_series(floor(greatest(e.pos - e.watched, 0) / 30)::int,
                         floor(e.pos / 30)::int) as b
    where e.watched > 0
  ),
  fine_visione as (           -- dove finisce ogni visione
    select distinct on (session) student, video, session, pos, at
    from ci_video_events
    order by session, at desc, id desc
  ),
  agg as (
    select student, video,
           count(distinct session)                                   as visioni,
           round(sum(watched))                                       as secondi,
           max(dur)                                                  as dur,
           bool_or(kind = 'ended')                                   as finito,
           min(at)                                                   as primo,
           max(at)                                                   as ultimo,
           count(*) filter (where kind = 'pause')                    as pause,
           count(*) filter (where kind = 'seek' and pos > from_pos)  as avanti,
           count(*) filter (where kind = 'seek' and pos < from_pos)  as indietro
    from ci_video_events
    group by student, video
  )
  select jsonb_build_object(
    'righe', coalesce((
      select jsonb_agg(jsonb_build_object(
               'student', a.student, 'video', a.video, 'visioni', a.visioni,
               'secondi', a.secondi, 'dur', a.dur, 'finito', a.finito,
               'primo', a.primo, 'ultimo', a.ultimo, 'pause', a.pause,
               'avanti', a.avanti, 'indietro', a.indietro,
               'blocchi', (select count(*) from blocchi k
                           where k.student = a.student and k.video = a.video),
               'stop', (select round(f.pos) from fine_visione f
                        where f.student = a.student and f.video = a.video
                        order by f.at desc limit 1))
             order by a.student, a.video)
      from agg a), '[]'::jsonb),
    'minuti', coalesce((
      select jsonb_agg(jsonb_build_object('video', video, 'b', b, 'n', n) order by video, b)
      from (select video, b, count(distinct student) as n
            from blocchi group by video, b) x), '[]'::jsonb)
  ) into out;
  return out;
end $$;

-- ---------------------------------------------------------------------
-- Dettaglio di uno studente su un video (tutti gli eventi, in ordine)
-- ---------------------------------------------------------------------
create or replace function public.ci_video_detail(p_student int, p_video text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me jsonb := public.ci_video_profile();
begin
  if me->>'role' is distinct from 'teacher' then
    raise exception 'Riservato all''insegnante' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'session', session, 'kind', kind, 'pos', round(pos::numeric, 1),
             'from', round(from_pos::numeric, 1), 'watched', round(watched::numeric, 1),
             'dur', dur, 'at', at) order by at, id)
    from (select * from ci_video_events
          where student = p_student and video = p_video
          order by at, id limit 5000) e), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- Azzera il registro dei video (solo insegnante)
-- ---------------------------------------------------------------------
create or replace function public.ci_video_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  me jsonb := public.ci_video_profile();
begin
  if me->>'role' is distinct from 'teacher' then
    raise exception 'Riservato all''insegnante' using errcode = '42501';
  end if;
  delete from ci_video_events where true;
end $$;

-- Permessi: solo utenti che hanno fatto l'accesso
revoke all on function public.ci_video_profile()                                       from public, anon;
revoke all on function public.ci_video_event(text, uuid, text, real, real, real, real)  from public, anon;
revoke all on function public.ci_video_report()                                        from public, anon;
revoke all on function public.ci_video_detail(int, text)                               from public, anon;
revoke all on function public.ci_video_reset()                                         from public, anon;
grant execute on function public.ci_video_event(text, uuid, text, real, real, real, real) to authenticated;
grant execute on function public.ci_video_report()                                       to authenticated;
grant execute on function public.ci_video_detail(int, text)                              to authenticated;
grant execute on function public.ci_video_reset()                                        to authenticated;
grant execute on function public.ci_video_profile()                                      to authenticated;

-- Fine. In basso deve comparire "Success. No rows returned".
