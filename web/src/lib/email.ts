import "server-only";

/**
 * Sends the claim magic link. With RESEND_API_KEY set it goes through Resend;
 * otherwise the link is printed to the server log so local dev still works.
 */
export async function sendMagicLink(to: string, url: string): Promise<{ delivered: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[vm-vitals] magic link for ${to}:\n  ${url}\n`);
    return { delivered: false };
  }
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const from = process.env.EMAIL_FROM || "VM Vitals <onboarding@resend.dev>";
  await resend.emails.send({
    from,
    to,
    subject: "Claim your machines on VM Vitals",
    text: `Click to claim your machines and sign in on this device:\n\n${url}\n\nThe link expires in 30 minutes. If you didn't ask for this, ignore it.`,
  });
  return { delivered: true };
}
