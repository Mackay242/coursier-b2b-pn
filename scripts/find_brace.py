import sys
for i in range(2496, 2679):
    l = open('src/app/page.tsx').readlines()[i]
    d = l.count('{') - l.count('}')
    if d != 0:
        print(f'{i+1}: {d:+d} {l.rstrip()[:100]}')
