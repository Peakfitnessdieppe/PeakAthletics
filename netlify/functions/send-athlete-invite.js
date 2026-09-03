const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const REDIRECT_URL = 'https://athletics.peakfitnessdieppe.ca/reset-password'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { athleteId, email, fullName } = JSON.parse(event.body || '{}')
    if (!athleteId || !email || !fullName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'athleteId, email, and fullName are required' }) }
    }

    // Look up the athlete's current auth email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(athleteId)
    if (userError) throw userError

    // If auth email differs from the invite email, update auth.users first
    if (userData.user.email !== email) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(athleteId, { email })
      if (updateError) throw updateError
    }

    // Generate recovery link using the (now-updated) email
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: REDIRECT_URL },
    })
    if (linkError) throw linkError
    const resetLink = linkData?.properties?.action_link
    if (!resetLink) throw new Error('Failed to generate reset link')

    const athleteFirstName = (fullName || '').trim().split(/\s+/)[0] || 'your athlete'

    const html = buildEmailHtml(fullName, athleteFirstName, resetLink)

    // Send email via Resend using fetch
    const resendRes = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Peak Athletics <info@peakfitnessdieppe.ca>',
        to: email,
        subject: "Your athlete's PFA performance profile is ready",
        html,
        reply_to: 'info@peakfitnessdieppe.ca',
      }),
    })

    if (!resendRes.ok) {
      const errText = await resendRes.text()
      throw new Error(`Resend error: ${resendRes.status} ${errText}`)
    }

    // Mark invite_sent_at
    await supabase.from('profiles').update({ invite_sent_at: new Date().toISOString() }).eq('id', athleteId)

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('send-athlete-invite error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

function buildEmailHtml(fullName, athleteFirstName, resetLink) {
  return `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head>
  <meta charset="UTF-8">
  <title>Your Athlete's PFA Profile Is Ready</title>
</head>
<body style="margin:0;padding:0;background:#0a0f0a;color:#f4fff6;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f0a;padding:24px 0;">
    <tr>
      <td>
        <div style="max-width:600px;margin:0 auto;background:rgba(10,15,10,0.97);border-radius:24px;box-shadow:0 30px 70px rgba(0,0,0,0.6);overflow:hidden;">

          <!-- HERO -->
          <div style="background:linear-gradient(180deg,#0f1f12,#0a0f0a);padding:42px 32px;text-align:center;">
            <img src="https://athletics.peakfitnessdieppe.ca/logos/pfa_logo.png" alt="Peak Fitness Athletics" width="120" style="margin-bottom:18px;">
            <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#3fae52;margin-bottom:18px;">Performance Testing Platform</div>
            <h1 style="margin:0;font-size:28px;color:#f4fff6;line-height:1.3;">${athleteFirstName}'s athlete profile is ready.</h1>
            <p style="margin:16px 0 0;font-size:15px;color:#c8f5d4;line-height:1.6;">PFA has tested ${athleteFirstName}'s speed, power, strength, endurance, and agility. The results are live — set up your account to view the full performance profile.</p>
          </div>

          <!-- BODY -->
          <div style="padding:38px 32px;">

            <!-- What you'll see -->
            <div style="margin-bottom:28px;">
              <h2 style="margin:0 0 14px;font-size:16px;color:#3fae52;text-transform:uppercase;letter-spacing:0.08em;">What's in the profile</h2>
              <div style="background:rgba(63,174,82,0.12);border:1px solid rgba(63,174,82,0.3);border-radius:18px;padding:20px;">
                <p style="margin:0 0 10px;font-size:14.5px;color:#e6f9ed;line-height:1.6;">⚡ <strong>PeakCard</strong> — a digital athlete card showing ${athleteFirstName}'s top test results and composite scores</p>
                <p style="margin:0 0 10px;font-size:14.5px;color:#e6f9ed;line-height:1.6;">📊 <strong>Performance Report</strong> — a detailed breakdown of every test with Level Readiness benchmarks compared to the next level of competition</p>
                <p style="margin:0;font-size:14.5px;color:#e6f9ed;line-height:1.6;">📈 <strong>Progress Tracking</strong> — see how ${athleteFirstName}'s numbers change every testing cycle</p>
              </div>
            </div>

            <!-- CTA -->
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetLink}" style="display:inline-block;padding:16px 36px;background:#3fae52;color:#0a0f0a;font-weight:700;font-size:16px;border-radius:14px;text-decoration:none;letter-spacing:0.02em;">Set Your Password & View Profile →</a>
              <p style="margin:14px 0 0;font-size:13px;color:#89a596;">This link expires in 24 hours. If it expires, <a href="https://athletics.peakfitnessdieppe.ca/login" style="color:#3fae52;">click here to request a new one</a>.</p>
            </div>

            <p style="margin:0;font-size:14px;color:#89a596;line-height:1.6;">Questions? Email us at <a href="mailto:info@peakfitnessdieppe.ca" style="color:#3fae52;">info@peakfitnessdieppe.ca</a> — we're happy to help.</p>
          </div>

          <!-- FOOTER -->
          <div style="padding:28px 32px;text-align:center;font-size:13px;color:#89a596;border-top:1px solid rgba(63,174,82,0.15);">
            Peak Fitness Athletics · Dieppe, NB ·
            <a href="mailto:info@peakfitnessdieppe.ca" style="color:#3fae52;">info@peakfitnessdieppe.ca</a>
          </div>

        </div>
      </td>
    </tr>
  </table>
</body>
</html>`
}
