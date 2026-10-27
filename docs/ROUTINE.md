# Prompt für die tägliche Routine

In Claude Code → geplante Aufgabe, Repository `MiTsCh13/roses-gallery`, neue Session pro Lauf:

```text
Du entwickelst Roses Gallery autonom weiter. Halte dich an CLAUDE.md, insbesondere
„Autonomer Arbeitsablauf“. Lies zuerst docs/STATUS.md und docs/DECISIONS.md.
Arbeite die nächsten offenen Schritte des aktuellen Meilensteins ab – so viele, wie
in sauberen, getesteten PRs möglich sind. Pro Schritt: Branch von main, umsetzen,
Tests schreiben, pnpm check (und bei UI pnpm test:e2e) grün, PR öffnen, CI abwarten,
bei Grün squash-mergen, bei Rot Ursache beheben. Fehlt eine Entscheidung oder ein
Zugang: in DECISIONS.md eintragen und an etwas anderem weiterarbeiten. Ist ein
Meilenstein fertig, Fertig-Kriterium aus docs/UMSETZUNGSPLAN.md prüfen und den
nächsten in STATUS.md aufschlüsseln. Zum Schluss STATUS.md aktualisieren und eine
kurze Zusammenfassung ausgeben: erledigt, offen, Entscheidungsbedarf.
```
