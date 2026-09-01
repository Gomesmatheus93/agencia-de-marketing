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

// ─── Templates transacionais ─────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char] ?? char);
}

function layout(input: {
  preheader: string;
  eyebrow: string;
  title: string;
  bodyHtml: string;
}): string {
  const baseUrl = ENV.appBaseUrl.replace(/\/$/, "");
  const logoUrl = `${baseUrl}/logo_completa.png`;
  const supportEmail = "suporte@krythoslab.com";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f5f8">
    <tr>
      <td align="center" style="padding:36px 16px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px">
          <tr>
            <td align="center" style="padding:0 0 22px">
              <a href="${escapeHtml(baseUrl)}" style="text-decoration:none">
                <img src="${escapeHtml(logoUrl)}" width="190" alt="KrythosLab" style="display:block;width:190px;max-width:65%;height:auto;border:0">
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:42px 40px;box-shadow:0 8px 30px rgba(17,24,39,.06)">
              <p style="margin:0 0 10px;color:#6d4aff;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${escapeHtml(input.eyebrow)}</p>
              <h1 style="margin:0 0 18px;color:#111827;font-size:26px;line-height:1.25;font-weight:750">${escapeHtml(input.title)}</h1>
              ${input.bodyHtml}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px;border-top:1px solid #eef0f4">
                <tr><td style="padding-top:22px">
                  <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.65"><strong style="color:#374151">🔒 Sua segurança importa.</strong><br>A KrythosLab nunca solicitará sua senha ou código de acesso por e-mail.</p>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 20px 0;color:#8b93a1;font-size:12px;line-height:1.7">
              <p style="margin:0 0 5px">Precisa de ajuda? <a href="mailto:${supportEmail}" style="color:#6d4aff;text-decoration:none">${supportEmail}</a></p>
              <p style="margin:0">KrythosLab · Marketing inteligente com IA</p>
              <p style="margin:5px 0 0"><a href="${escapeHtml(baseUrl)}" style="color:#8b93a1;text-decoration:underline">krythoslab.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function actionButton(label: string, link: string): string {
  const safeLink = escapeHtml(link);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0">
    <tr><td style="border-radius:10px;background:#6d4aff">
      <a href="${safeLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1;border-radius:10px;background:linear-gradient(135deg,#3455f5,#8b3fe8)">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

function fallbackLink(link: string): string {
  return `<div style="margin-top:24px;padding:16px;background:#f8f7ff;border:1px solid #ebe7ff;border-radius:10px">
    <p style="margin:0 0 7px;color:#6b7280;font-size:12px;line-height:1.5">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
    <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.5"><a href="${escapeHtml(link)}" style="color:#5b3fd8;text-decoration:underline">${escapeHtml(link)}</a></p>
  </div>`;
}

export function verificationEmail(name: string, link: string): SendEmailInput {
  const safeName = escapeHtml(name || "usuário");
  return {
    to: "",
    subject: "Confirme seu e-mail | KrythosLab",
    tag: "verify-email",
    text: `Olá ${name},\n\nSua conta na KrythosLab está quase pronta. Confirme seu e-mail pelo link abaixo:\n${link}\n\nEste link expira em 24 horas e pode ser usado apenas uma vez.\n\nSe você não criou esta conta, ignore esta mensagem.\n\nKrythosLab`,
    html: layout({
      preheader: "Confirme seu endereço de e-mail para ativar sua conta na KrythosLab.",
      eyebrow: "Ativação de conta",
      title: "Confirme seu e-mail",
      bodyHtml: `<p style="margin:0;color:#374151;font-size:15px;line-height:1.7">Olá, <strong>${safeName}</strong>!</p>
        <p style="margin:12px 0 0;color:#4b5563;font-size:15px;line-height:1.7">Sua conta na KrythosLab está quase pronta. Confirme seu endereço de e-mail para ativar o acesso e proteger sua conta.</p>
        ${actionButton("Confirmar meu e-mail", link)}
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6">⏱️ Este link expira em <strong>24 horas</strong> e pode ser utilizado apenas uma vez.</p>
        ${fallbackLink(link)}
        <p style="margin:16px 0 0;color:#8b93a1;font-size:12px;line-height:1.6">Se você não criou uma conta na KrythosLab, pode ignorar esta mensagem com segurança.</p>`,
    }),
  };
}

export function passwordResetEmail(name: string, link: string): SendEmailInput {
  const safeName = escapeHtml(name || "usuário");
  return {
    to: "",
    subject: "Redefina sua senha | KrythosLab",
    tag: "password-reset",
    text: `Olá ${name},\n\nRecebemos uma solicitação para redefinir sua senha. Use o link abaixo:\n${link}\n\nO link expira em 30 minutos e pode ser usado apenas uma vez.\n\nSe você não solicitou a alteração, ignore esta mensagem. Sua senha continuará a mesma.\n\nKrythosLab`,
    html: layout({
      preheader: "Use este link seguro para criar uma nova senha na KrythosLab.",
      eyebrow: "Segurança da conta",
      title: "Redefina sua senha",
      bodyHtml: `<p style="margin:0;color:#374151;font-size:15px;line-height:1.7">Olá, <strong>${safeName}</strong>!</p>
        <p style="margin:12px 0 0;color:#4b5563;font-size:15px;line-height:1.7">Recebemos uma solicitação para redefinir a senha da sua conta. Use o botão abaixo para criar uma nova senha.</p>
        ${actionButton("Redefinir minha senha", link)}
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6">⏱️ Por segurança, este link expira em <strong>30 minutos</strong> e pode ser usado apenas uma vez.</p>
        ${fallbackLink(link)}
        <div style="margin-top:18px;padding:14px 16px;background:#fff8eb;border:1px solid #fde6b8;border-radius:10px;color:#78520b;font-size:12px;line-height:1.6"><strong>Não solicitou esta alteração?</strong><br>Ignore este e-mail. Sua senha continuará a mesma.</div>`,
    }),
  };
}

export function twoFactorCodeEmail(name: string, code: string): SendEmailInput {
  const safeName = escapeHtml(name || "usuário");
  const safeCode = escapeHtml(code);
  return {
    to: "",
    subject: `${code} é seu código de acesso | KrythosLab`,
    tag: "2fa-code",
    text: `Olá ${name},\n\nSeu código de verificação é: ${code}\n\nEle expira em 10 minutos. Não compartilhe este código.\n\nKrythosLab`,
    html: layout({
      preheader: `${code} é seu código temporário de acesso à KrythosLab.`,
      eyebrow: "Verificação em duas etapas",
      title: "Seu código de acesso",
      bodyHtml: `<p style="margin:0;color:#374151;font-size:15px;line-height:1.7">Olá, <strong>${safeName}</strong>!</p>
        <p style="margin:12px 0 0;color:#4b5563;font-size:15px;line-height:1.7">Use o código abaixo para concluir seu acesso à KrythosLab:</p>
        <div style="margin:26px 0;padding:20px;text-align:center;background:#f8f7ff;border:1px solid #e5dfff;border-radius:12px;color:#33236f;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;font-weight:800;letter-spacing:9px">${safeCode}</div>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6">⏱️ Este código expira em <strong>10 minutos</strong>. Não compartilhe com ninguém.</p>
        <div style="margin-top:18px;padding:14px 16px;background:#fff8eb;border:1px solid #fde6b8;border-radius:10px;color:#78520b;font-size:12px;line-height:1.6">Se você não tentou entrar, recomendamos alterar sua senha imediatamente.</div>`,
    }),
  };
}
