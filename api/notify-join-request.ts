/**
 * Vercel Serverless / Edge: notifica o titular por email (Resend).
 * Env: RESEND_API_KEY, opcional RESEND_FROM (ex.: Planize <noreply@seudominio.com>)
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(null, { status: 405 })
  }

  let body: { ownerEmail?: string; guestEmail?: string; accessKeyId?: string; appUrl?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { ownerEmail, guestEmail, accessKeyId = '', appUrl = '' } = body
  if (!ownerEmail?.includes('@') || !guestEmail?.includes('@')) {
    return new Response(JSON.stringify({ error: 'missing email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const key = process.env.RESEND_API_KEY
  if (!key) {
    return new Response(JSON.stringify({ ok: true, emailed: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const origin = appUrl || 'https://vercel.app'
  const from = process.env.RESEND_FROM || 'Planize <onboarding@resend.dev>'

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [ownerEmail],
      subject: `Planize: pedido de acesso (chave ${accessKeyId})`,
      html: `<p><strong>${guestEmail}</strong> pediu acesso ao espaço com a chave <code>${accessKeyId}</code>.</p>
<p>Abra o Planize com a sua conta (mesmo email de titular), vá a <strong>Ajustes</strong> e toque em <strong>Aprovar</strong> no aviso no topo.</p>
<p><a href="${origin}">Abrir Planize</a></p>`,
    }),
  })

  if (!r.ok) {
    const t = await r.text()
    return new Response(JSON.stringify({ error: t }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, emailed: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
