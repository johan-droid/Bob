import nodemailer from 'nodemailer';

export async function sendAlertEmail(issueDetails: any): Promise<void> {
  const user = process.env.GMAIL_ADDRESS;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.ALERT_RECIPIENTS;

  if (!user || !pass || !to) {
    console.warn('Gmail Notification Service is not fully configured (missing env vars).');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  const subject = `[Bob Alert] 🚨 Auto-PR Raised for ${issueDetails.repo}`;
  const html = `
    <h2>Bob PR Health Monitor</h2>
    <p>An auto-remediation PR has been raised for a failure in <b>${issueDetails.repo}</b>.</p>
    <ul>
      <li><b>Failure Type:</b> ${issueDetails.type || 'Unknown'}</li>
      <li><b>Branch:</b> ${issueDetails.branch || 'unknown'}</li>
    </ul>
    <p>Please review the Draft PR on GitHub.</p>
  `;

  try {
    await transporter.sendMail({
      from: `"Bob PR Health Monitor" <${user}>`,
      to,
      subject,
      html
    });
    console.log(`Alert email sent to ${to}`);
  } catch (err) {
    console.error('Failed to send alert email:', err);
  }
}
