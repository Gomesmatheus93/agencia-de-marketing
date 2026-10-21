type NewsletterTemplateParams = {
  title: string;
  preheader: string;
  intro: string;
  highlights: { heading: string; text: string }[];
  conclusion: string;
  ctaText: string;
  coverImageUrl?: string | null;
  sourceUrl?: string | null;
  brandName?: string;
};

export function buildNewsletterHtml(params: NewsletterTemplateParams): string {
  const {
    title,
    preheader,
    intro,
    highlights,
    conclusion,
    ctaText,
    coverImageUrl,
    sourceUrl,
    brandName = "Alle Energia",
  } = params;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const coverBlock = coverImageUrl
    ? `<tr>
        <td style="padding:0;">
          <img src="${esc(coverImageUrl)}" alt="${esc(title)}" width="600"
            style="display:block;width:100%;max-height:340px;object-fit:cover;border:0;" />
        </td>
      </tr>`
    : "";

  const highlightRows = highlights
    .map(
      (h, i) => `
      <tr>
        <td style="padding:0 0 28px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 0 10px 0;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:#06b6d4;width:28px;height:28px;border-radius:50%;text-align:center;vertical-align:middle;">
                      <span style="color:#0f172a;font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:28px;">${i + 1}</span>
                    </td>
                    <td style="padding-left:12px;vertical-align:middle;">
                      <span style="color:#0f172a;font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${esc(h.heading)}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="color:#374151;font-size:15px;line-height:1.7;font-family:Georgia,'Times New Roman',serif;">
                ${esc(h.text)}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  const ctaBlock = sourceUrl
    ? `<tr>
        <td align="center" style="padding:12px 40px 48px 40px;">
          <a href="${esc(sourceUrl)}"
            style="display:inline-block;background:#0f172a;color:#06b6d4;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:14px 36px;border-radius:6px;font-family:Arial,Helvetica,sans-serif;">
            ${esc(ctaText)}
          </a>
        </td>
      </tr>`
    : "";

  const today = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date());

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${esc(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader (hidden) -->
  <div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Email container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#0f172a;padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="color:#06b6d4;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
                      ${esc(brandName)}
                    </span>
                  </td>
                  <td align="right">
                    <span style="color:#475569;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                      ${esc(today)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Cover image ── -->
          ${coverBlock}

          <!-- ── Title block ── -->
          <tr>
            <td style="background:#0f172a;padding:32px 40px 28px 40px;">
              <h1 style="margin:0;color:#f8fafc;font-size:26px;line-height:1.3;font-family:Georgia,'Times New Roman',serif;font-weight:700;">
                ${esc(title)}
              </h1>
            </td>
          </tr>

          <!-- ── Cyan divider ── -->
          <tr>
            <td style="background:#06b6d4;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── Intro ── -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <p style="margin:0;color:#374151;font-size:16px;line-height:1.8;font-family:Georgia,'Times New Roman',serif;">
                ${esc(intro)}
              </p>
            </td>
          </tr>

          <!-- ── Section label ── -->
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#06b6d4;width:32px;height:2px;vertical-align:middle;">&nbsp;</td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#6b7280;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
                      Destaques
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Highlights ── -->
          <tr>
            <td style="padding:0 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${highlightRows}
              </table>
            </td>
          </tr>

          <!-- ── Conclusion ── -->
          <tr>
            <td style="padding:4px 40px 40px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:32px 0 0 0;color:#374151;font-size:15px;line-height:1.8;font-family:Georgia,'Times New Roman',serif;">
                ${esc(conclusion)}
              </p>
            </td>
          </tr>

          <!-- ── CTA ── -->
          ${ctaBlock}

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#0f172a;padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="color:#475569;font-size:12px;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
                      Você está recebendo este e-mail porque se inscreveu na newsletter da ${esc(brandName)}.<br />
                      <a href="#" style="color:#06b6d4;text-decoration:underline;">Cancelar inscrição</a>
                    </span>
                  </td>
                  <td align="right">
                    <span style="color:#06b6d4;font-size:12px;font-weight:700;letter-spacing:2px;font-family:Arial,Helvetica,sans-serif;">
                      ${esc(brandName)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
