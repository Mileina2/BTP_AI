import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_SECURE !== "true",
    auth: { user, pass },
  });
  return transporter;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getFromAddress() {
  const addr = process.env.SMTP_FROM || process.env.SMTP_USER;
  const name = process.env.SMTP_FROM_NAME || "BTP IA";
  return `"${name}" <${addr}>`;
}

function getLoginUrl() {
  return process.env.FRONTEND_URL || "http://localhost:4173";
}

/**
 * Template email responsive (compatible Gmail / Outlook).
 */
function buildEmailHtml({
  preheader,
  title,
  intro,
  paragraphs = [],
  credentialsHtml = "",
  ctaUrl,
  ctaLabel,
  secondaryCtaUrl,
  secondaryCtaLabel,
  note,
}) {
  const bodyParagraphs = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151">${p}</p>`)
    .join("");

  const ctaBlock = ctaUrl && ctaLabel
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0">
        <tr>
          <td style="border-radius:10px;background:linear-gradient(135deg,#1d4ed8,#2563eb)">
            <a href="${escapeHtml(ctaUrl)}" target="_blank"
              style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">
              ${escapeHtml(ctaLabel)}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const secondaryCta =
    secondaryCtaUrl && secondaryCtaLabel
      ? `<p style="margin:16px 0 0;text-align:center"><a href="${escapeHtml(secondaryCtaUrl)}" style="font-size:14px;color:#2563eb;font-weight:600">${escapeHtml(secondaryCtaLabel)}</a></p>`
      : "";

  const linkFallback =
    ctaUrl
      ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all">${escapeHtml(ctaUrl)}</p>`
      : "";

  const noteBlock = note
    ? `<p style="margin:24px 0 0;padding:12px 16px;background:#f3f4f6;border-radius:8px;font-size:13px;line-height:1.5;color:#4b5563">${note}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center">
              <div style="font-size:11px;font-weight:600 letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);margin-bottom:8px">ERP BTP</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.2">BTP IA</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${escapeHtml(title)}</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(intro)}</p>
              ${bodyParagraphs}
              ${credentialsHtml}
              ${ctaBlock}
              ${secondaryCta}
              ${linkFallback}
              ${noteBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center">
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af">
                Chantiers · Devis · Factures · Terrain
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db">
                Si vous n'êtes pas à l'origine de cette action, ignorez cet email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  const tx = getTransporter();

  if (!tx) {
    if (process.env.NODE_ENV !== "production") {
      console.log("📧 [dev] Email non envoyé — SMTP non configuré");
      console.log(`   À: ${to}`);
      console.log(`   Sujet: ${subject}`);
      console.log(`   ${text}`);
      if (attachments.length) console.log(`   Pièces jointes: ${attachments.map((a) => a.filename).join(", ")}`);
    } else {
      console.error("❌ Email non envoyé : configurez SMTP dans back/.env");
    }
    return { sent: false, dev: true };
  }

  try {
    await tx.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text,
      html,
      attachments,
    });
    return { sent: true };
  } catch (err) {
    console.error("❌ Erreur SMTP (Brevo) :", err.message);
    return { sent: false, error: err.message };
  }
}

/** Email professionnel avec PDF devis / facture en pièce jointe. */
export async function sendDocumentEmail({
  to,
  subject,
  docType,
  docNumber,
  clientName,
  organizationName,
  amountLabel,
  extraLines = [],
  attachment,
  extraAttachments = [],
}) {
  const orgLine = organizationName
    ? `<strong>${escapeHtml(organizationName)}</strong>`
    : "Votre entreprise BTP";

  const paragraphs = [
    `Veuillez trouver ci-joint votre <strong>${escapeHtml(docType.toLowerCase())} n° ${escapeHtml(docNumber)}</strong>.`,
    `Montant total TTC : <strong>${escapeHtml(amountLabel)}</strong>.`,
    ...extraLines.map((line) => escapeHtml(line.replace(/<[^>]+>/g, ""))),
    "Le document PDF est joint à cet email.",
  ];

  const html = buildEmailHtml({
    preheader: `${docType} ${docNumber}`,
    title: `${docType} ${docNumber}`,
    intro: clientName ? `Bonjour ${escapeHtml(clientName)},` : "Bonjour,",
    paragraphs,
    note: "Pour toute question, répondez directement à cet email.",
  });

  const textLines = [
    clientName ? `Bonjour ${clientName},` : "Bonjour,",
    "",
    `${docType} n° ${docNumber}`,
    `Montant TTC : ${amountLabel}`,
    ...extraLines.map((l) => l.replace(/<[^>]+>/g, "")),
    "",
    "Le PDF est en pièce jointe.",
    organizationName ? `\n${organizationName}` : "",
  ];

  return sendEmail({
    to,
    subject,
    text: textLines.join("\n"),
    html,
    attachments: [...(attachment ? [attachment] : []), ...extraAttachments],
  });
}

export async function sendPasswordResetEmail(to, resetURL) {
  const html = buildEmailHtml({
    preheader: "Réinitialisez votre mot de passe BTP IA",
    title: "Mot de passe oublié ?",
    intro: "Bonjour,",
    paragraphs: [
      "Vous avez demandé à réinitialiser le mot de passe de votre compte BTP IA.",
      "Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.",
    ],
    ctaUrl: resetURL,
    ctaLabel: "Réinitialiser mon mot de passe",
    note: "⏱ Ce lien est valable <strong>10 minutes</strong>. Après expiration, refaites une demande depuis l'application.",
  });

  return sendEmail({
    to,
    subject: "Réinitialisation de votre mot de passe — BTP IA",
    text: `Bonjour,\n\nRéinitialisez votre mot de passe (10 min) :\n${resetURL}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html,
  });
}

export async function sendVerificationEmail(to, verifyURL) {
  const html = buildEmailHtml({
    preheader: "Confirmez votre email pour activer votre compte BTP IA",
    title: "Confirmez votre adresse email",
    intro: "Bonjour,",
    paragraphs: [
      "Merci pour votre inscription sur <strong>BTP IA</strong>.",
      "Pour sécuriser votre compte et accéder à l'application, validez votre adresse email en un clic.",
    ],
    ctaUrl: verifyURL,
    ctaLabel: "Valider mon email",
    note: "⏱ Ce lien expire dans <strong>24 heures</strong>. Vous ne pourrez pas vous connecter tant que votre email n'est pas validé.",
  });

  return sendEmail({
    to,
    subject: "Confirmez votre email — BTP IA",
    text: `Bonjour,\n\nValidez votre email (24 h) :\n${verifyURL}`,
    html,
  });
}

export async function sendWelcomeEmail(to, nom) {
  const html = buildEmailHtml({
    preheader: "Votre compte BTP IA est activé",
    title: "Bienvenue sur BTP IA !",
    intro: `Bonjour ${nom},`,
    paragraphs: [
      "Votre email a été confirmé. Votre compte entrepreneur est maintenant <strong>actif</strong>.",
      "Vous pouvez gérer vos chantiers, devis, factures, équipe et rapports terrain depuis l'application.",
    ],
    ctaUrl: getLoginUrl(),
    ctaLabel: "Ouvrir BTP IA",
    note: "Besoin d'aide ? Contactez l'administrateur de votre organisation.",
  });

  return sendEmail({
    to,
    subject: "Bienvenue sur BTP IA — compte activé",
    text: `Bonjour ${nom},\n\nVotre compte BTP IA est activé. Connectez-vous sur ${getLoginUrl()}`,
    html,
  });
}

export async function sendTwoFactorEmail(to, code, purpose = "login") {
  const titles = {
    login: "Code de connexion — BTP IA",
    enable: "Activer la double authentification",
    disable: "Désactiver la double authentification",
  };
  const intros = {
    login: "Utilisez ce code pour terminer votre connexion :",
    enable: "Confirmez l'activation de la double authentification :",
    disable: "Confirmez la désactivation de la double authentification :",
  };

  const html = buildEmailHtml({
    preheader: `Code de sécurité : ${code}`,
    title: titles[purpose] || titles.login,
    intro: intros[purpose] || intros.login,
    paragraphs: [
      `<strong style="font-size:28px;letter-spacing:6px;color:#111">${code}</strong>`,
      "Ce code expire dans <strong>10 minutes</strong>. Ne le partagez avec personne.",
      "Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe immédiatement.",
    ],
    note: "BTP IA — sécurité de votre compte entrepreneur.",
  });

  return sendEmail({
    to,
    subject: `${titles[purpose] || titles.login} (${code})`,
    text: `Votre code BTP IA : ${code}\n\nValide 10 minutes. Ne le partagez pas.`,
    html,
  });
}

function credentialsBox({ email, tempPassword, profileLabel, loginUrl }) {
  const rows = [
    `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Email</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827">${escapeHtml(email)}</td></tr>`,
    profileLabel
      ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Profil</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827">${escapeHtml(profileLabel)}</td></tr>`
      : "",
    tempPassword
      ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Mot de passe temporaire</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;font-family:monospace">${escapeHtml(tempPassword)}</td></tr>`
      : "",
    loginUrl
      ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Connexion</td><td style="padding:6px 0;font-size:13px"><a href="${escapeHtml(loginUrl)}" style="color:#2563eb">${escapeHtml(loginUrl)}</a></td></tr>`
      : "",
  ].join("");

  return `
    <div style="margin:20px 0;padding:16px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.05em">Vos identifiants</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </div>`;
}

/** Invitation chef de chantier ou portail propriétaire. */
export async function sendTeamInvitationEmail({
  to,
  prenom,
  roleLabel,
  profileLabel,
  organizationName,
  loginUrl,
  email,
  tempPassword,
  passwordSetupUrl,
  contextLines = [],
}) {
  const orgLine = organizationName
    ? `<strong>${escapeHtml(organizationName)}</strong> vous a invité à rejoindre BTP IA.`
    : "Vous avez été invité à rejoindre BTP IA.";

  const paragraphs = [
    orgLine,
    `Votre accès : <strong>${escapeHtml(roleLabel)}</strong>.`,
    ...contextLines,
    tempPassword
      ? "Vous pouvez vous connecter tout de suite avec le mot de passe temporaire ci-dessous, ou choisir votre propre mot de passe via le bouton."
      : "Cliquez sur le bouton pour choisir votre mot de passe, puis connectez-vous.",
  ];

  const html = buildEmailHtml({
    preheader: `Invitation BTP IA — ${roleLabel}`,
    title: prenom ? `Bienvenue ${prenom}` : "Bienvenue sur BTP IA",
    intro: prenom ? `Bonjour ${prenom},` : "Bonjour,",
    paragraphs,
    credentialsHtml: credentialsBox({
      email,
      tempPassword,
      profileLabel,
      loginUrl,
    }),
    ctaUrl: passwordSetupUrl,
    ctaLabel: "Choisir mon mot de passe",
    secondaryCtaUrl: loginUrl,
    secondaryCtaLabel: "Ouvrir la page de connexion →",
    note: "⏱ Le lien pour choisir votre mot de passe est valable <strong>7 jours</strong>. Sur la page de connexion, sélectionnez le bon profil avant de vous identifier.",
  });

  const textLines = [
    `Bonjour ${prenom || ""},`,
    `Invitation BTP IA — ${roleLabel}`,
    organizationName ? `Organisation : ${organizationName}` : "",
    `Email : ${email}`,
    tempPassword ? `Mot de passe temporaire : ${tempPassword}` : "",
    `Profil à sélectionner : ${profileLabel}`,
    `Connexion : ${loginUrl}`,
    `Choisir mot de passe : ${passwordSetupUrl}`,
  ].filter(Boolean);

  return sendEmail({
    to,
    subject: `Invitation BTP IA — ${roleLabel}`,
    text: textLines.join("\n"),
    html,
  });
}

/** Notification entrepreneur : devis accepté ou refusé par le client. */
export async function sendDevisStatusNotificationEmail({
  to,
  entrepreneurName,
  devisNumero,
  clientName,
  statut,
  statutRaw,
  montantLabel,
  organizationName,
  signatureNom,
}) {
  const accepted = statutRaw === "ACCEPTE";
  const title = accepted ? "Devis accepté par le client" : "Devis refusé par le client";
  const preheader = `${devisNumero} — ${statut}`;

  const paragraphs = accepted
    ? [
        `Le client <strong>${escapeHtml(clientName)}</strong> a accepté le devis <strong>${escapeHtml(devisNumero)}</strong>.`,
        `Montant TTC : <strong>${escapeHtml(montantLabel)}</strong>.`,
        signatureNom ? `Signé au nom de : ${escapeHtml(signatureNom)}.` : "",
        "Vous pouvez facturer depuis l'application (Devis → Facturer).",
      ].filter(Boolean)
    : [
        `Le client <strong>${escapeHtml(clientName)}</strong> a refusé le devis <strong>${escapeHtml(devisNumero)}</strong>.`,
        `Montant TTC : <strong>${escapeHtml(montantLabel)}</strong>.`,
        "Pensez à créer une nouvelle version ou un devis révisé si vous renégociez.",
      ];

  const html = buildEmailHtml({
    preheader,
    title,
    intro: entrepreneurName ? `Bonjour ${escapeHtml(entrepreneurName)},` : "Bonjour,",
    paragraphs,
    ctaUrl: getLoginUrl(),
    ctaLabel: "Ouvrir BTP IA",
    note: accepted
      ? "Notification automatique du portail propriétaire BTP IA."
      : "Notification automatique — vous pouvez dupliquer ou créer une nouvelle version du devis.",
  });

  const text = [
    entrepreneurName ? `Bonjour ${entrepreneurName},` : "Bonjour,",
    "",
    `${title} — ${devisNumero}`,
    `Client : ${clientName}`,
    `Montant TTC : ${montantLabel}`,
    `Statut : ${statut}`,
    signatureNom ? `Signé : ${signatureNom}` : "",
    "",
    organizationName || "BTP IA",
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to,
    subject: `${title} — ${devisNumero}`,
    text,
    html,
  });
}
