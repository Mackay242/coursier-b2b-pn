#!/usr/bin/env python3
"""Test WhatsApp Bot - tout en une seule exécution Python"""
import requests, json, sys

BASE = 'http://127.0.0.1:3000'
s = requests.Session()

def log(msg):
    print(msg, flush=True)

try:
    log('=== Test WhatsApp Bot ===\n')

    # 1. CSRF
    log('1. CSRF token...')
    r = s.get(f'{BASE}/api/auth/csrf')
    csrf = r.json()['csrfToken']
    log(f'   OK: {csrf[:20]}...')

    # 2. Login
    log('2. Login admin...')
    r = s.post(f'{BASE}/api/auth/callback/credentials', data={
        'csrfToken': csrf,
        'email': 'loicmakayi@gmail.com',
        'password': '066120648CASTEL',
        'callbackUrl': BASE,
    }, allow_redirects=True)
    log(f'   Status final: {r.status_code}')

    sess = s.get(f'{BASE}/api/auth/session').json()
    user = sess.get('user', {})
    log(f'   User: {user.get("email", "N/A")}')
    log(f'   Role: {user.get("role", "N/A")}')

    if not user.get('email'):
        log('\n❌ Auth failed!')
        sys.exit(1)

    # 3. Webhook verify
    log('\n3. Webhook verify...')
    r = requests.get(f'{BASE}/api/whatsapp/webhook', params={
        'hub.mode': 'subscribe',
        'hub.verify_token': 'coursier-pn-verify-2024',
        'hub.challenge': 'HELLO_META',
    })
    log(f'   Status: {r.status_code} | Body: {r.text}')
    log(f'   {"✅" if r.text == "HELLO_META" else "❌"}')

    # 4. Test commands
    tests = [
        ('Aide', 'aide'),
        ('Commander incomplet', 'commander:'),
        ('Commander complet', 'commander:\ndépart=BGFI Centre-ville\ndestination=TotalEnergies Loandjili\ndestinataire=Jean Mouamba\ntel=065123456\ndesc=Documents confidentiels'),
        ('Suivi existant', 'suivi CMD-2024-0002'),
        ('Suivi inexistant', 'suivi CMD-2099-999'),
        ('Historique', 'historique'),
        ('Inconnu', 'xyz random'),
    ]

    for name, msg in tests:
        log(f'\n── {name} ──')
        r = s.post(f'{BASE}/api/whatsapp/simulate', json={'message': msg, 'from': '242066000000'})
        if r.ok:
            data = r.json()
            if data.get('success'):
                log(f'   ✅ Action: {data["parsed"]["action"]}')
                reply = data['reply'].replace('\n', '\n   ')[:250]
                log(f'   Réponse: {reply}')
            else:
                log(f'   ❌ {json.dumps(data)[:200]}')
        else:
            log(f'   ❌ HTTP {r.status_code}: {r.text[:200]}')

    # 5. Logs
    log('\n── Logs ──')
    r = s.get(f'{BASE}/api/whatsapp/logs')
    if r.ok:
        logs = r.json().get('logs', [])
        log(f'   ✅ {len(logs)} logs')
    else:
        log(f'   ❌ HTTP {r.status_code}')

    log('\n=== Terminé ===')

except requests.ConnectionError:
    log('\n❌ Serveur injoignable. Redémarrez le serveur puis relancez ce script immédiatement.')
    sys.exit(1)
except Exception as e:
    log(f'\n❌ Erreur: {e}')
    sys.exit(1)
