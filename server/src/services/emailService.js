import nodemailer from "nodemailer";

const isConfigured = () => process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

let transporter = null;
const getTransporter = () => {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

/**
 * Sends a verification email, or — if SMTP isn't configured — logs the
 * verification link to the console so local development still works end to end.
 */
export const sendVerificationEmail = async (toEmail, verifyUrl) => {
  const t = getTransporter();

  if (!t) {
    console.log("\n──────────────────────────────────────────");
    console.log("SMTP not configured — logging verification link instead of emailing it:");
    console.log(`To: ${toEmail}`);
    console.log(`Link: ${verifyUrl}`);
    console.log("Set SMTP_HOST / SMTP_USER / SMTP_PASS in server/.env to send real emails.");
    console.log("──────────────────────────────────────────\n");
    return { delivered: false, devLink: verifyUrl };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || `"Formify.ai" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Verify your Formify.ai email",
    html: `<p>Welcome to Formify.ai! Please verify your email address:</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>
           <p>This link expires in 24 hours.</p>`,
  });

  return { delivered: true };
};
