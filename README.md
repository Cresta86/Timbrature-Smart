# Timbrature Smart

Applicazione web statica per registrare entrata, uscita finale, pausa pranzo e giornate di Smart Working.

## Funzioni principali

- salvataggio anche della sola entrata;
- calcolo dell'uscita necessaria per completare 8 ore;
- Smart Working fisso dalle 08:00 alle 16:45;
- inserimento automatico dello Smart Working per i giorni ricorrenti del mese;
- conteggio separato di minuti ordinari, minuti extra in blocchi da 15 e minuti mancanti;
- gestione della flessibilità e del basket mensile d'ingresso;
- esportazione del mese in formato CSV;
- funzionamento su computer e smartphone.

I dati rimangono esclusivamente nel browser utilizzato (`localStorage`). Il sito non invia timbrature a SAP e non condivide dati con servizi esterni.

## Pubblicazione con GitHub Pages

1. Crea un nuovo repository su GitHub.
2. Estrai questo archivio ZIP.
3. Carica **tutti i file estratti nella radice del repository**, mantenendo `index.html` nella pagina principale.
4. Apri **Settings → Pages** nel repository.
5. In **Build and deployment**, scegli **Deploy from a branch**.
6. Seleziona il branch **main**, la cartella **/(root)** e premi **Save**.
7. Attendi il completamento della pubblicazione indicato da GitHub.

Non sono richiesti Node.js, dipendenze, compilazione, database o chiavi API.

## File del progetto

- `index.html`: struttura della pagina;
- `styles.css`: grafica responsive;
- `core.js`: regole e calcoli delle timbrature;
- `app.js`: calendario, salvataggio locale ed esportazione CSV;
- `.nojekyll`: impedisce elaborazioni non necessarie da parte di GitHub Pages.

Versione applicazione: **2026.10.27.6**

