// Envio de e-mail transacional (verificação de conta, recuperação de senha,
// códigos 2FA) via webhook do n8n.
//
// O servidor faz POST em N8N_EMAIL_WEBHOOK_URL com o header X-Api-Key = N8N_SECRET.
// O fluxo no n8n deve validar esse header e então enviar o e-mail pelo provedor
// que a agência usar (SMTP, Sendgrid, SES, etc).
//
// Payload:
//   { to: string, from: string, subject: string, html: string, text: string, tag: string }
//
// Sem N8N_EMAIL_WEBHOOK_URL configurada (ambiente de dev), o e-mail é só logado
// no console — os fluxos continuam testáveis.

import { ENV } from "./env";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tag?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { to, subject, html, text, tag } = input;

  if (!ENV.resendApiKey && !ENV.n8nEmailWebhookUrl) {
    console.log(
      `\n[email:dev] (RESEND_API_KEY/N8N_EMAIL_WEBHOOK_URL não configurados)\n` +
        `  para:     ${to}\n` +
        `  assunto:  ${subject}\n` +
        `  tag:      ${tag ?? "-"}\n` +
        `  texto:\n${(text ?? html).replace(/^/gm, "    ")}\n`
    );
    return;
  }

  const payload = {
    to,
    from: ENV.emailFrom,
    subject,
    html,
    text: text ?? html.replace(/<[^>]+>/g, " "),
    tag: tag ?? "transactional",
  };

  const attempt = async () => {
    const usingResend = Boolean(ENV.resendApiKey);
    const res = await fetch(usingResend ? "https://api.resend.com/emails" : ENV.n8nEmailWebhookUrl, {
      method: "POST",
      headers: usingResend
        ? { "Content-Type": "application/json", Authorization: `Bearer ${ENV.resendApiKey}` }
        : { "Content-Type": "application/json", "X-Api-Key": ENV.n8nSecret },
      body: JSON.stringify(usingResend
        ? { from: payload.from, to: [payload.to], subject: payload.subject, html: payload.html, text: payload.text, tags: [{ name: "type", value: payload.tag }] }
        : payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const provider = usingResend ? "Resend" : "n8n email webhook";
      throw new Error(`${provider} retornou ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  };

  try {
    await attempt();
  } catch (err) {
    console.warn("[email] 1ª tentativa falhou, repetindo:", String(err));
    await attempt();
  }
}

// ─── Templates simples ───────────────────────────────────────────────────────

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f7;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <h1 style="font-size:18px;color:#111;margin:0 0 16px">${title}</h1>
    ${bodyHtml}
    <p style="font-size:12px;color:#9ca3af;margin-top:24px">KrythosLab · Se você não solicitou este e-mail, pode ignorá-lo.</p>
  </div></body></html>`;
}

export function verificationEmail(name: string, link: string): SendEmailInput {
  return {
    to: "",
    subject: "Confirme seu e-mail — KrythosLab",
    tag: "verify-email",
    text: `Olá ${name}, confirme seu e-mail: ${link}`,
    html: layout(
      "Confirme seu e-mail",
      `<p style="font-size:14px;color:#374151">Olá ${name}, falta pouco para ativar sua conta.</p>
       <p style="margin:24px 0"><a href="${link}" style="background:#7c3aed;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:14px">Confirmar e-mail</a></p>
       <p style="font-size:12px;color:#6b7280">Ou copie: ${link}</p>`
    ),
  };
}

export function passwordResetEmail(name: string, link: string): SendEmailInput {
  return {
    to: "",
    subject: "Redefinição de senha — KrythosLab",
    tag: "password-reset",
    text: `Olá ${name}, redefina sua senha: ${link} (expira em 30 minutos)`,
    html: layout(
      "Redefinir senha",
      `<p style="font-size:14px;color:#374151">Olá ${name}, recebemos um pedido para redefinir sua senha.</p>
       <p style="margin:24px 0"><a href="${link}" style="background:#7c3aed;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:14px">Redefinir senha</a></p>
       <p style="font-size:12px;color:#6b7280">O link expira em 30 minutos. Se não foi você, ignore este e-mail.</p>`
    ),
  };
}

export function twoFactorCodeEmail(name: string, code: string): SendEmailInput {
  return {
    to: "",
    subject: `${code} é seu código de acesso — KrythosLab`,
    tag: "2fa-code",
    text: `Olá ${name}, seu código de verificação é ${code} (expira em 10 minutos).`,
    html: layout(
      "Seu código de acesso",
      `<p style="font-size:14px;color:#374151">Olá ${name}, use o código abaixo para entrar:</p>
       <p style="font-size:32px;letter-spacing:6px;font-weight:700;color:#111;margin:24px 0">${code}</p>
       <p style="font-size:12px;color:#6b7280">Expira em 10 minutos. Se não foi você, troque sua senha.</p>`
    ),
  };
}
