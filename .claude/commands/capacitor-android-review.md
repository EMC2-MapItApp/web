---
description: Revisa el trabajo actual con el subagente capacitor-android-reviewer (permisos, componentes exportados, cleartext, deep links, firma — android/ y Capacitor, repo WEB)
argument-hint: "[rama o commit base opcional]"
---

Lanza el agente `capacitor-android-reviewer` (Agent tool, `subagent_type:
capacitor-android-reviewer`, `run_in_background: false`) para revisar exclusivamente la
superficie nativa Android/Capacitor en el repo WEB, según su propio checklist
(`.claude/agents/capacitor-android-reviewer.md`) — no le pidas nada fuera de ese alcance.

Alcance a pasarle en el prompt:
- Si se indicó un argumento (`$ARGUMENTS`), es una rama/commit base: pídele que revise
  `git diff $ARGUMENTS...HEAD`.
- Si no hay argumento, pídele que revise primero `git status` + `git diff` (cambios sin
  commitear); si no hay nada sin commitear, que revise el último commit
  (`git diff HEAD~1`).

Cuando el agente termine, muéstrame su informe de findings tal cual (o confirma "sin
hallazgos en la superficie nativa" si no reportó ninguno) — no lo reformules ni lo resumas
de más.
