# Login unificado: sistema da Alle → Agência Alle (portal das academias)

Este documento explica como o sistema da Alle envia um usuário já logado para o portal das academias, em `https://agencia.alleenergia.com`.

## Como funciona

1. A pessoa está logada no sistema da Alle e clica para abrir o portal de marketing.
2. O sistema da Alle gera um **token JWT** de curta duração e envia para a rota **`/sso`**.
3. A agência confere a assinatura do token. Se for o primeiro acesso, ela **cria a conta e as academias**. Em todo acesso, ela **sincroniza as academias liberadas** e abre o portal.

As contas criadas assim não têm senha na agência: entram **só** pelo sistema da Alle.

## Como enviar o token

Qualquer uma das três formas:

| Forma | Exemplo |
| --- | --- |
| Link (GET) | `https://agencia.alleenergia.com/sso?token=<JWT>` |
| Formulário ou JSON (POST) | `POST https://agencia.alleenergia.com/sso` com o campo `token` |
| Cabeçalho | `Authorization: Bearer <JWT>` em `GET` ou `POST /sso` |

A resposta grava a sessão e **redireciona (302)** para o portal (`/app/unidade`). Use a rota numa **navegação do navegador** (link, redirecionamento ou formulário), não numa chamada em segundo plano, para a sessão ficar no navegador da pessoa.

## O token

### Assinatura

- **Padrão:** HS256 com o segredo compartilhado `ALLE_SSO_SECRET` (pelo menos 32 caracteres), configurado nos dois lados.
- **Alternativa:** RS256 ou ES256 com chave pública. Nesse caso, a agência configura `ALLE_SSO_PUBLIC_KEY` (PEM) e `ALLE_SSO_ALG` (`RS256` ou `ES256`).
- **Opcional:** se a agência definir `ALLE_SSO_ISSUER` ou `ALLE_SSO_AUDIENCE`, o token precisa trazer o `iss` ou o `aud` correspondente.

### Campos

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `sub` | sim | ID do usuário no sistema da Alle (texto ou número). Identifica a conta: não reaproveite IDs. |
| `email` | sim | E-mail do usuário. |
| `nome` | sim | Nome para exibir. |
| `role` | sim | Cargo: `gestor`, `visualizador`, `regional`, `direcao` ou `super_admin`. Fica registrado e aparece no painel. |
| `academias` | sim | Lista `[{ "id": ..., "nome": "..." }]` com as academias liberadas. O `id` é o código fixo da academia no sistema da Alle (número ou texto). |
| `todas_academias` | sim | `true` para quem vê todas as academias; `false` para os demais. |
| `grupo_nome` | não | Nome do grupo (regional). |
| `exp` | sim | Validade, em segundos (Unix). **No máximo 10 minutos** à frente. Recomendado: 2 a 5 minutos. |
| `iat` | recomendado | Momento da emissão. |
| `jti` | recomendado | ID único do token. **Cada token só pode ser usado uma vez**: sem `jti`, a agência usa o próprio token como identificador. |

### Por cargo

| Cargo | `academias` | `todas_academias` |
| --- | --- | --- |
| Gestor | 1 academia | `false` |
| Visualizador | 1 academia | `false` |
| Regional | todas as academias do grupo | `false` (e `grupo_nome` preenchido) |
| Direção | lista vazia `[]` | `true` |
| Super admin | lista vazia `[]` | `true` |

O acesso é definido por `todas_academias` e `academias`, não pelo nome do cargo. Se um regional perder uma academia, ela some do portal dele no próximo login.

### Exemplo de token (regional)

```json
{
  "sub": "1287",
  "email": "regional.natal@allpfit.com.br",
  "nome": "Maria Souza",
  "role": "regional",
  "academias": [
    { "id": 12, "nome": "Allp Fit Capim Macio" },
    { "id": 15, "nome": "Allp Fit Ponta Negra" }
  ],
  "todas_academias": false,
  "grupo_nome": "Natal",
  "iat": 1794520000,
  "exp": 1794520180,
  "jti": "1a8f3c2e-5b7d-4e90-9c11-2f6a8b0d4e77"
}
```

### Exemplo em Node.js (biblioteca `jose`)

```js
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";

const secret = new TextEncoder().encode(process.env.ALLE_SSO_SECRET);

async function linkDoPortal(usuario) {
  const token = await new SignJWT({
    email: usuario.email,
    nome: usuario.nome,
    role: usuario.cargo,                        // "gestor" | "visualizador" | "regional" | "direcao" | "super_admin"
    academias: usuario.academias.map((a) => ({ id: a.id, nome: a.nome })),
    todas_academias: usuario.todasAcademias,    // true para direção e super admin
    grupo_nome: usuario.grupo ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(usuario.id))
    .setIssuedAt()
    .setExpirationTime("3m")
    .setJti(randomUUID())
    .sign(secret);
  return `https://agencia.alleenergia.com/sso?token=${encodeURIComponent(token)}`;
}
```

## Mensagens de erro

| Situação | Mensagem |
| --- | --- |
| Assinatura errada, token vencido ou sem `exp` | "Link de acesso inválido ou expirado." |
| `exp` a mais de 10 minutos | "Link de acesso com validade longa demais." |
| O mesmo token usado de novo | "Este link de acesso já foi usado." Gere um token novo a cada clique. |
| `todas_academias: false` com a lista vazia | "Nenhuma academia liberada para este usuário." |
| Campo faltando ou em formato errado | "O token não traz o campo "…" no formato esperado." |
| E-mail de alguém da equipe da agência | Recusado: contas da equipe usam o login normal. |
| Academia, ou todas as academias da pessoa, desativada no painel | Recusado, com aviso para falar com a equipe da Alle. |

## Segurança

- O segredo (ou a chave privada) fica **só no servidor** do sistema da Alle. Nunca vai para o navegador nem para o app.
- Gere o token **no momento do clique** e envie na hora. Não guarde links de acesso.
- Os cargos do sistema da Alle **não** viram administradores da agência. Direção e super admin entram com acesso de leitura a todas as academias. A administração da plataforma é configurada só pela equipe da agência.

## O que o usuário acessa

Só o portal das academias:

- o **planejamento semanal** publicado pela equipe da Alle (o mesmo para todas): artes para baixar e legendas para copiar;
- os **materiais gerais** e o **mídia kit da academia aberta**. Quem tem mais de uma academia troca no topo do portal.

O resto da plataforma (agentes de IA, analytics, postagens, configurações e envio de arquivos) é bloqueado no servidor para essas contas.
