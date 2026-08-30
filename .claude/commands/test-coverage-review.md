---
description: Revisa el trabajo actual con el subagente test-coverage-reviewer (cobertura de tests en servicios y guards, repo WEB)
argument-hint: "[rama o commit base opcional]"
---

Lanza el agente `test-coverage-reviewer` (Agent tool, `subagent_type:
test-coverage-reviewer`, `run_in_background: false`) para revisar exclusivamente
cobertura de tests de servicios y guards funcionales en el repo WEB, según su propio
checklist (`.claude/agents/test-coverage-reviewer.md`) — no le pidas nada fuera de ese
alcance.

Alcance a pasarle en el prompt:
- Si se indicó un argumento (`$ARGUMENTS`), es una rama/commit base: pídele que revise
  `git diff $ARGUMENTS...HEAD`.
- Si no hay argumento, pídele que revise primero `git status` + `git diff` (cambios sin
  commitear); si no hay nada sin commitear, que revise el último commit
  (`git diff HEAD~1`).

Cuando el agente termine, muéstrame su informe de findings tal cual (o confirma "sin
hallazgos de cobertura de tests" si no reportó ninguno) — no lo reformules ni lo resumas
de más.
