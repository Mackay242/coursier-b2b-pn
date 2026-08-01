import sys
lines = sys.stdin.readlines()
opens = 0
closes = 0
for i, line in enumerate(lines):
    o = line.count('{')
    c = line.count('}')
    opens += o
    closes += c
    if o != 0 or c != 0:
        print(f'  {2496+i+1}: +{o}/-{c} (net={opens-closes})  {line.rstrip()[:100]}')
print(f'Total: +{opens}/-{closes}')