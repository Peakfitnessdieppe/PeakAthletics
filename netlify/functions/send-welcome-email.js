const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, fullName } = JSON.parse(event.body);
    const firstName = fullName?.split(' ')[0] || 'Athlete';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to PFA</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0f0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://athletics.peakfitnessdieppe.ca/logos/pfa_logo.png" alt="Peak Fitness Athletics" width="80" style="display:block;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#111a11;border:1px solid #1f2e1f;border-radius:12px;padding:40px 36px 32px;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#3fae52;font-weight:600;">Peak Fitness Athletics</p>
              <h1 style="margin:0 0 6px;font-size:32px;font-weight:800;color:#ffffff;line-height:1.1;">Welcome, ${firstName}.</h1>
              <h2 style="margin:0 0 24px;font-size:18px;font-weight:600;color:#3fae52;line-height:1.2;">Your PFA account is active.</h2>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#b0bcb0;">
                PFA tracks physical performance across every testing cycle — speed, power, strength, agility, and endurance. If testing data is already on file, you'll see it in your profile. If not, your baseline is coming.
              </p>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#3fae52;border-radius:8px;">
                    <a href="https://athletics.peakfitnessdieppe.ca" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#0a0f0a;text-decoration:none;letter-spacing:0.3px;">
                      Go to My Profile →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" style="padding:0 6px 0 0;vertical-align:top;">
                    <div style="background-color:#111a11;border:1px solid #1f2e1f;border-radius:10px;padding:20px 16px;">
                      <p style="margin:0 0 6px;font-size:18px;">📍</p>
                      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#ffffff;">The Baseline</p>
                      <p style="margin:0;font-size:12px;color:#6b7f6b;line-height:1.4;">Where ${firstName} stands today, measured and on record</p>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 3px;vertical-align:top;">
                    <div style="background-color:#111a11;border:1px solid #1f2e1f;border-radius:10px;padding:20px 16px;">
                      <p style="margin:0 0 6px;font-size:18px;">🧭</p>
                      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#ffffff;">How to Train</p>
                      <p style="margin:0;font-size:12px;color:#6b7f6b;line-height:1.4;">Understand the physical qualities that drive athletic development</p>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 0 0 6px;vertical-align:top;">
                    <div style="background-color:#111a11;border:1px solid #1f2e1f;border-radius:10px;padding:20px 16px;">
                      <p style="margin:0 0 6px;font-size:18px;">📈</p>
                      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#ffffff;">Track Progress</p>
                      <p style="margin:0;font-size:12px;color:#6b7f6b;line-height:1.4;">Every re-test shows the direction — and how far they've come</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;">
              <p style="margin:0;font-size:13px;color:#4a5e4a;line-height:1.6;text-align:center;">
                Physical development takes time. This profile gives ${firstName} a clear starting point — and a way to see real progress with every testing cycle.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;">
              <hr style="border:none;border-top:1px solid #1a2a1a;margin:0;" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;font-size:12px;color:#3a4e3a;">Questions? Email us at <a href="mailto:info@peakfitnessdieppe.ca" style="color:#3fae52;text-decoration:none;">info@peakfitnessdieppe.ca</a></p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#2a3a2a;letter-spacing:1px;text-transform:uppercase;">Peak Fitness Athletics · Dieppe, NB</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Peak Athletics <info@peakfitnessdieppe.ca>',
        to: [email],
        subject: `Welcome to PFA, ${firstName}`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return { statusCode: 500, body: JSON.stringify({ error: data }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.handler = handler;
