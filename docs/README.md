# Guida al progetto Beach Volley

Questa applicazione React consente di visualizzare e gestire un torneo di beach volley utilizzando Supabase come backend. Le funzionalità principali includono:

* **Agenda giornaliera** per ogni squadra con partite dove la squadra è coinvolta come giocatrice o come arbitro, con colorazioni diverse a seconda del ruolo.
* **Classifiche** dei gironi e delle fasi finali Gold/Silver, aggiornate in tempo reale sfruttando i dati in Supabase.
* **Brackets** per le fasi Gold e Silver che mostrano le partite con i risultati parziali dei set e il vincitore.
* **Statistiche di squadra** che riepilogano partite giocate, vinte, perse, set vinti/persi e punti classifica attraverso tutte le fasi.

## Struttura del progetto

```
beach-volley-app/
├── docs/                # questa guida
├── package.json         # configurazione npm
├── vite.config.ts       # configurazione Vite
├── tsconfig.json        # configurazione TypeScript
├── .env                 # variabili ambiente Supabase (non committare le tue chiavi reali)
├── index.html           # entry point dell'applicazione
├── src/
│   ├── main.tsx        # bootstrap React
│   ├── App.tsx         # componente principale con navigazione tra le viste
│   ├── utils/
│   │   └── supabase.ts # inizializzazione client Supabase
│   └── components/     # componenti per Agenda, Classifica, Bracket, Statistiche
└── supabase_scripts/
    ├── 001_create_schema.sql # script SQL completo per creare lo schema da zero
    └── 002_alter_schema.sql  # script di aggiornamento per schemi esistenti
```

## Avvio in sviluppo

1. **Installazione dipendenze**

   Prima di tutto assicurati di avere Node.js installato. Dentro la cartella `beach-volley-app` esegui:

   ```bash
   npm install
   ```

2. **Configurazione Supabase**

   Il file `.env` contiene le variabili d'ambiente per collegarsi al tuo progetto Supabase. Sostituisci `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` con i valori del tuo progetto Supabase. Se usi Vercel, dovrai configurare queste variabili anche lì (vedi sotto).

3. **Avvio server di sviluppo**

   Avvia l'applicazione con:

   ```bash
   npm run dev
   ```

   Vite avvierà un server locale (di solito su http://localhost:5173) che ricarica automaticamente i cambiamenti.

## Distribuzione su Vercel

Per distribuire l'applicazione su Vercel:

1. **Repository GitHub** – carica l'intero contenuto della cartella `beach-volley-app` in un repository GitHub.

2. **Connetti Vercel** – dal tuo account Vercel, crea un nuovo progetto collegando il repository. Vercel rileverà automaticamente che si tratta di un progetto Vite/React.

3. **Imposta variabili ambiente** – in Vercel, aggiungi le variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nella sezione “Environment Variables”. Assicurati di usare le stesse chiavi che usi in locale.

4. **Build e deploy** – Vercel eseguirà `npm install` e `npm run build`. Assicurati che nella sezione Settings > Build & Output Settings il comando di build sia `npm run build` e la cartella di output sia `dist/`.

## Modifiche al database

Sono forniti due script SQL nella cartella `supabase_scripts`:

* **001_create_schema.sql**: crea tutte le tabelle necessarie (`torneo`, `campo`, `squadra`, `girone`, `girone_squadra`, `fase_torneo`, `partita`, `partita_set`, `classifica`, `qualificazione_fase`) e inserisce le fasi base (`GIRONI`, `GOLD`, `SILVER`) e tre campi di esempio. Usa questo script se parti da un database vuoto.

* **002_alter_schema.sql**: applica modifiche incrementalmente a uno schema esistente. Rende obbligatoria la colonna `campo_id` nella tabella `partita`, crea la tabella `campo` se non esiste, imposta un vincolo di unicità su `(torneo_id, nome)` e inserisce tre campi di esempio se mancanti. Usa questo se hai già eseguito una versione precedente dello schema e vuoi aggiornarla.

Per applicare gli script su Supabase puoi utilizzare la sezione **SQL Editor** della dashboard:

1. Carica e esegui `001_create_schema.sql` per creare lo schema da zero. Se il tuo database esiste già, passa direttamente allo script di aggiornamento.
2. Carica e esegui `002_alter_schema.sql` per allineare la struttura alle modifiche più recenti. Gli script sono idempotenti: se i vincoli o le tabelle esistono già, non verranno duplicati.

### Ordine degli script

Gli script sono numerati secondo l'ordine con cui dovrebbero essere eseguiti:

1. **001_create_schema.sql** – crea lo schema e i dati di base.
2. **002_alter_schema.sql** – aggiorna lo schema (opzionale, solo se necessario).

## Personalizzazioni future

La logica di calcolo delle classifiche in questa app presuppone che le tabelle `classifica` vengano aggiornate via procedure server-side o da un job esterno. Se desideri modificare il comportamento (ad esempio calcolare le classifiche al volo nel client), puoi estendere i componenti React oppure creare API serverless da richiamare dall'app.

Per aggiungere nuove funzionalità (es. registrazione delle squadre, inserimento risultati) potrai creare ulteriori componenti React e funzioni Supabase. Ricorda di aggiornare gli script SQL con eventuali nuove tabelle o colonne e aggiungerle in ordine sequenziale (003_*, 004_*, ecc.).