import re

with open('src/app/page.tsx', 'r') as f:
    lines = f.readlines()

start = None
brace_count = 0
end = None
for i, line in enumerate(lines):
    if 'function PaiementView()' in line:
        start = i
        brace_count = line.count('{') - line.count('}')
        continue
    if start is not None:
        brace_count += line.count('{') - line.count('}')
        if brace_count <= 0:
            end = i + 1
            break

print(f'PaiementView: lines {start+1} to {end}')

with open('scripts/new_paiement.txt', 'r') as f:
    new_content = f.read()

new_lines = lines[:start] + [new_content + '\n'] + lines[end:]

with open('src/app/page.tsx', 'w') as f:
    f.writelines(new_lines)

print(f'Replaced. New file has {len(new_lines)} lines')