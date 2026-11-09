-- =====================================================================
-- 5AFM2627 · ACCESSO CON NUMERO DI REGISTRO + COMPLEANNO (giorno e mese)
--
-- In Supabase: SQL Editor → New query → incolla → scrivi accanto a ogni
-- numero il compleanno nel formato 'gg/mm' (es. '16/09') → Run.
-- Le righe lasciate vuote ('') non vengono toccate.
-- Poi cancella la query senza salvarla.
--
-- Nel database non viene scritto il compleanno, ma solo la sua impronta
-- cifrata (come per qualsiasi password). Sul sito lo studente può scrivere
-- 16/09, 16-9 oppure 1609. Vale per i video e per l'area giochi.
-- =====================================================================

with compleanni (numero, data) as (values
  ( 1, ''), ( 2, ''), ( 3, ''), ( 4, ''), ( 5, ''), ( 6, ''), ( 7, ''),
  ( 8, ''), ( 9, ''), (10, ''), (11, ''), (12, ''), (13, ''), (14, ''),
  (15, ''), (16, ''), (17, ''), (18, ''), (19, ''), (20, ''), (21, ''),
  (22, ''), (23, ''), (24, ''), (25, ''), (26, ''), (27, '')
)
update auth.users u
set encrypted_password = extensions.crypt(
      'Classe!' || lpad(split_part(c.data, '/', 1), 2, '0') || lpad(split_part(c.data, '/', 2), 2, '0'),
      extensions.gen_salt('bf')),
    updated_at = now()
from compleanni c
where trim(c.data) <> ''
  and u.email = 'studente' || lpad(c.numero::text, 2, '0') || '@classe.invalid'
returning u.email as studente_aggiornato;
