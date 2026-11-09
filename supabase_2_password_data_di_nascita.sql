-- =====================================================================
-- 5AFM2627 · ACCESSO CON NUMERO DI REGISTRO + DATA DI NASCITA
--
-- Come si usa (in Supabase: SQL Editor → New query):
--   1. Incolla questo file.
--   2. Accanto a ogni numero di registro scrivi la data di nascita
--      nel formato 'gg/mm/aaaa', per esempio '14/03/2008'.
--      Le righe lasciate vuote ('') non vengono toccate: quegli studenti
--      continuano a entrare con il codice di prima (1234).
--   3. Premi Run. In basso compare l'elenco degli studenti aggiornati.
--   4. NON salvare la query (le date di nascita resterebbero nell'elenco
--      delle query salvate): chiudi la scheda senza salvarla.
--
-- Nel database non viene scritta la data, ma solo la sua impronta
-- cifrata (come per qualsiasi password).
-- Sul sito lo studente può scrivere la data come 14/03/2008, 14032008
-- oppure 140308: il sito la trasforma sempre in 140308.
-- Vale sia per i video sia per l'area giochi.
-- =====================================================================

with nascite (numero, data) as (values
  ( 1, ''), ( 2, ''), ( 3, ''), ( 4, ''), ( 5, ''),
  ( 6, ''), ( 7, ''), ( 8, ''), ( 9, ''), (10, ''),
  (11, ''), (12, ''), (13, ''), (14, ''), (15, ''),
  (16, ''), (17, ''), (18, ''), (19, ''), (20, ''),
  (21, ''), (22, ''), (23, ''), (24, ''), (25, ''),
  (26, '')
)
update auth.users u
set encrypted_password = extensions.crypt(
      'Classe!' || to_char(to_date(n.data, 'DD/MM/YYYY'), 'DDMMYY'),
      extensions.gen_salt('bf')),
    updated_at = now()
from nascite n
where trim(n.data) <> ''
  and u.email = 'studente' || lpad(n.numero::text, 2, '0') || '@classe.invalid'
returning u.email as studente_aggiornato;
