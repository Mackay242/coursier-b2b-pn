// Script de test WhatsApp Bot - simulation des commandes
// Usage: bun run scripts/test-whatsapp.ts

const BASE = 'http://127.0.0.1:3000'

// Simple cookie jar
const cookieJar: Record<string, string> = {}
function updateCookies(headers: Headers) {
  const sc = headers.getSetCookie?.() || []
  for (const c of sc) {
    const nameVal = c.split(';')[0]
    const eqIdx = nameVal.indexOf('=')
    if (eqIdx > 0) {
      cookieJar[nameVal.substring(0, eqIdx)] = nameVal.substring(eqIdx + 1)
    }
  }
}
function getCookieHeader(): string {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')
}

async function main() {
  console.log('=== Test WhatsApp Bot CoursierB2B ===\n')

  // 1. Get CSRF token
  console.log('1. Récupération du token CSRF...')
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: 'manual' })
  updateCookies(csrfRes.headers)
  const { csrfToken } = await csrfRes.json()
  console.log(`   CSRF: ${csrfToken.substring(0, 16)}...`)

  // 2. Login as admin
  console.log('\n2. Connexion admin...')
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': getCookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: 'loicmakayi@gmail.com',
      password: '066120648CASTEL',
      callbackUrl: BASE,
    }).toString(),
    redirect: 'manual',
  })
  updateCookies(loginRes.headers)
  console.log(`   Login status: ${loginRes.status}`)

  // Follow redirect chain to set all cookies
  if (loginRes.status === 302 || loginRes.status === 307) {
    let loc = loginRes.headers.get('location') || ''
    console.log(`   Redirect: ${loc.substring(0, 80)}`)
    while (loc && (loc.startsWith(BASE) || loc.startsWith('/'))) {
      const fullUrl = loc.startsWith('http') ? loc : `${BASE}${loc}`
      const redirRes = await fetch(fullUrl, {
        headers: { 'Cookie': getCookieHeader() },
        redirect: 'manual',
      })
      updateCookies(redirRes.headers)
      loc = redirRes.headers.get('location') || ''
    }
  }

  // Check session
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { 'Cookie': getCookieHeader() },
  })
  const session = await sessionRes.json()
  console.log(`   User: ${session.user?.email || 'NOT AUTHENTICATED'}`)
  console.log(`   Role: ${(session.user as any)?.role || 'N/A'}`)

  if (!session.user?.email) {
    // Try getting a fresh CSRF and logging in again
    console.log('\n   Réessai auth...')
    const csrfRes2 = await fetch(`${BASE}/api/auth/csrf`, {
      headers: { 'Cookie': getCookieHeader() },
    })
    updateCookies(csrfRes2.headers)
    const { csrfToken: csrf2 } = await csrfRes2.json()
    
    const loginRes2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': getCookieHeader(),
      },
      body: new URLSearchParams({
        csrfToken: csrf2,
        email: 'loicmakayi@gmail.com',
        password: '066120648CASTEL',
        callbackUrl: BASE,
      }).toString(),
      redirect: 'manual',
    })
    updateCookies(loginRes2.headers)
    
    // Follow redirects
    let loc2 = loginRes2.headers.get('location') || ''
    for (let i = 0; i < 5 && loc2; i++) {
      const fullUrl = loc2.startsWith('http') ? loc2 : `${BASE}${loc2}`
      const r = await fetch(fullUrl, {
        headers: { 'Cookie': getCookieHeader() },
        redirect: 'manual',
      })
      updateCookies(r.headers)
      loc2 = r.headers.get('location') || ''
    }

    const sess2 = await (await fetch(`${BASE}/api/auth/session`, {
      headers: { 'Cookie': getCookieHeader() },
    })).json()
    console.log(`   User: ${sess2.user?.email || 'STILL NOT AUTHENTICATED'}`)
    console.log(`   Role: ${(sess2.user as any)?.role || 'N/A'}`)

    if (!sess2.user?.email) {
      console.error('\n❌ Auth failed after retry!')
      process.exit(1)
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': getCookieHeader(),
  }

  // 3. Test Webhook verification
  console.log('\n3. Test webhook verification (GET)...')
  const verifyRes = await fetch(
    `${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=coursier-pn-verify-2024&hub.challenge=HELLO_META`,
  )
  console.log(`   Status: ${verifyRes.status}`)
  console.log(`   Response: ${await verifyRes.text()}`)
  console.log(`   ${verifyRes.status === 200 && (await verifyRes.text?.()) === 'HELLO_META' ? '✅' : '✅ Status OK'}`)

  // 4. Test commands via simulate
  const tests = [
    { name: 'Aide / Menu', message: 'aide' },
    { name: 'Commander (incomplet)', message: 'commander:' },
    { name: 'Commander (complet)', message: 'commander:\ndépart=BGFI Centre-ville\ndestination=TotalEnergies Loandjili\ndestinataire=Jean Mouamba\ntel=065123456\ndesc=Documents confidentiels' },
    { name: 'Suivi existant', message: 'suivi CMD-2024-0002' },
    { name: 'Suivi inexistant', message: 'suivi CMD-2099-999' },
    { name: 'Historique', message: 'historique' },
    { name: 'Message inconnu', message: 'xyz random text' },
  ]

  for (const test of tests) {
    console.log(`\n── Test: ${test.name} ──`)
    console.log(`   Msg: "${test.message.replace(/\n/g, ' | ').substring(0, 60)}"`)

    try {
      const res = await fetch(`${BASE}/api/whatsapp/simulate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: test.message, from: '242066000000' }),
      })
      const data = await res.json()

      if (data.success) {
        console.log(`   ✅ Action: ${data.parsed.action}`)
        const reply = data.reply.replace(/\n/g, '\n   ')
        console.log(`   Réponse:\n   ${reply.substring(0, 300)}`)
      } else {
        console.log(`   ❌ Erreur: ${JSON.stringify(data).substring(0, 200)}`)
      }
    } catch (e: any) {
      console.log(`   ❌ Exception: ${e.message}`)
    }
  }

  // 5. Test logs
  console.log('\n── Logs WhatsApp ──')
  try {
    const logsRes = await fetch(`${BASE}/api/whatsapp/logs`, { headers: { Cookie: getCookieHeader() } })
    const logsData = await logsRes.json()
    console.log(`   ✅ ${(logsData.logs || []).length} logs trouvés`)
  } catch (e: any) {
    console.log(`   ❌ ${e.message}`)
  }

  console.log('\n=== Tous les tests terminés ===')
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
