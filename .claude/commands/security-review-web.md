---
description: Revisa el trabajo actual con el subagente security-reviewer (XSS/DOM, JWT/sesión, open redirect, secretos de cliente — repo WEB)
argument-hint: "[rama o commit base opcional]"
---

Lanza el agente `security-reviewer` (Agent tool, `subagent_type: security-reviewer`,
`run_in_background: false`) para revisar exclusivamente las superficies de seguridad
propias de este frontend en el repo WEB, según su propio checklist
(`.claude/agents/security-reviewer.md`) — no le pidas nada fuera de ese alcance. Esto no
sustituye una revisión completa con `/security-review` antes de un despliegue grande.

Alcance a pasarle en el prompt:
- Si se indicó un argumento (`$ARGUMENTS`), es una rama/commit base: pídele que revise
  `git diff $ARGUMENTS...HEAD`.
- Si no hay argumento, pídele que revise primero `git status` + `git diff` (cambios sin
  commitear); si no hay nada sin commitear, que revise el último commit
  (`git diff HEAD~1`).

Cuando el agente termine, muéstrame su informe de findings tal cual (o confirma "sin
hallazgos de seguridad" si no reportó ninguno) — no lo reformules ni lo resumas de más.
