with open('src/app/page.tsx', 'r') as f:
    content = f.read()
old = '          <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />'
new = '          </div>'
if old in content:
    content = content.replace(old, new, 1)
    with open('src/app/page.tsx', 'w') as f:
        f.write(content)
    print('Fixed')
else:
    print('Not found')