# Origem das skills

Copiadas de https://github.com/Jakeschincariol/instagram-agent-skill
(commit d03c56b, licença MIT — ver LICENSE).

Cada pasta `ig-*` vira um agente interno da plataforma (server/agents/registry.ts).
Os scripts Python são executados pela ferramenta `run_script` dos agentes.

## Adaptações locais

- `ig-human/slop.pt.json`: léxico em português (mesmo formato do `slop.json`
  original), usado por padrão pelo humanizador e pelo detector. O original em
  inglês continua intacto e pode ser usado com `language: "en"`.
