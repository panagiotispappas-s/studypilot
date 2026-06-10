# StudyPilot

StudyPilot ist eine lokale Lern- und Notiz-App für Schule, Studium, Ausbildung und Weiterbildung.

## Entwicklung

```bash
npm run dev
```

## Prüfung

```bash
npm run typecheck
npm run lint
npm run build
```

Die App speichert Notizdaten in IndexedDB des Browsers.

## Deployment

StudyPilot ist eine Next.js-App mit App Router und benötigt aktuell keine Environment Variables. Vercel erkennt das Projekt automatisch.

Empfohlene Vercel-Einstellungen:

- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`
- Production Branch: `main`
