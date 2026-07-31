with open('src/app/page.tsx', 'r') as f:
    content = f.read()

old_notif_block = '''          {/* Notifications */
          <div className="relative">
            <Button variant="ghost" size="icon" className="relative" onClick={() => setNotifOpen(!notifOpen)}>
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
          </div>'''

new_notif_block = '          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="icon" className="relative" onClick={() => setNotifOpen(!notifOpen)}>
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
          </div>'

if old_notif_block in content:
    content = content.replace(old_notif_block, new_notif_block, 1)
    with open('src/app/page.tsx', 'w') as f:
        f.write(content)
    print('Removed NotificationPanel from JSX, count:', content.count(old_notif_block))
else:
    print('NOT FOUND')
