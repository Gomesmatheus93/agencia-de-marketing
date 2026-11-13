# Login unificado: sistema da Alle → Agência Alle (portal das unidades)

Este documento explica como o sistema da Alle envia uma academia parceira (unidade) já logada para o portal da agência, em `https://agencia.alleenergia.com`.

## Como funciona

1. A pessoa está logada no sistema da Alle e clica em **"Marketing"** (ou outro nome de botão que vocês escolherem).
2. O sistema da Alle gera um **token JWT** de curta duração, assinado com um segredo compartilhado, e redireciona para:

   ```
   https://agencia.alleenergia.com/sso/alle?token=<JWT>
   ```

3. A agência confere a assinatura do token. Se for o primeiro acesso, ela **cria a unidade e a conta**; depois, só faz o login. Em seguida, mostra o portal da unidade (planejamento semanal e materiais).

Não existe senha na agência para essas contas: elas entram **só** pelo sistema da Alle.

## O token

- **Algoritmo:** HS256.
- **Segredo:** o mesmo valor de `ALLE_SSO_SECRET` configurado na agência, com pelo menos 32 caracteres. A equipe da agência passa esse valor por um canal seguro.

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `sub` | sim | ID fixo da pessoa no sistema da Alle. Identifica a conta: não reaproveite IDs. |
| `email` | sim | E-mail da pessoa. |
| `name` | sim | Nome para exibir. |
| `unit_code` | sim | Código fixo da unidade: letras minúsculas, números, `-` e `_`, até 64 caracteres (ex.: `capim-macio`). É ele que liga a pessoa à unidade. |
| `unit_name` | sim | Nome da unidade (ex.: `Allp Fit Capim Macio`). É usado ao criar a unidade. |
| `iss` | sim | Sempre `alle`. |
| `aud` | sim | Sempre `agencia-alle`. |
| `iat` | sim | Momento da emissão, em segundos (Unix). |
| `exp` | sim | Validade, **no máximo 10 minutos** depois de `iat`. Recomendado: 2 a 5 minutos. |
| `jti` | sim | ID único do token (UUID). **Cada token só pode ser usado uma vez.** |

### Exemplo em Node.js (biblioteca `jose`)

```js
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";

const secret = new TextEncoder().encode(process.env.ALLE_SSO_SECRET);

async function linkDaAgencia(pessoa, unidade) {
  const token = await new SignJWT({
    email: pessoa.email,
    name: pessoa.nome,
    unit_code: unidade.codigo,
    unit_name: unidade.nome,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(pessoa.id))
    .setIssuer("alle")
    .setAudience("agencia-alle")
    .setIssuedAt()
    .setExpirationTime("3m")
    .setJti(randomUUID())
    .sign(secret);
  return `https://agencia.alleenergia.com/sso/alle?token=${encodeURIComponent(token)}`;
}
```

Em outras linguagens, use uma biblioteca JWT que assine em HS256 com os mesmos campos.

## Regras e mensagens de erro

| Situação | O que acontece |
| --- | --- |
| Token válido | Entra no portal da unidade. |
| Assinatura errada, token vencido, `iss` ou `aud` diferente | "Link de acesso inválido ou expirado." |
| Validade maior que 10 minutos | "Link de acesso com validade longa demais." |
| O mesmo token usado de novo | "Este link de acesso já foi usado." Gere um token novo a cada clique. |
| E-mail de alguém da equipe da agência | Recusado: contas da equipe não entram por aqui. |
| Unidade ou conta desativada no painel da agência | Recusado, com aviso para falar com a equipe da Alle. |

## Segurança

- O segredo fica **só no servidor** do sistema da Alle. Nunca vai para o navegador nem para o app.
- Gere o token **no momento do clique** e redirecione na hora. Não guarde links de acesso.
- Para trocar o segredo, mudem os dois lados ao mesmo tempo, no mesmo deploy.

## O que a conta da unidade acessa

Só o portal da unidade:

- o **planejamento semanal** publicado pela equipe da Alle (o mesmo para todas as unidades): artes para baixar e legendas para copiar;
- os **materiais gerais** e o **mídia kit da própria unidade**.

O resto da plataforma (agentes de IA, analytics, postagens, configurações) é bloqueado no servidor para essas contas.
