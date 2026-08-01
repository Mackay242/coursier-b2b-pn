import re

with open('src/app/page.tsx', 'r') as f:
    lines = f.readlines()

# Find DispatchView function boundaries
start = None
brace_count = 0
end = None
for i, line in enumerate(lines):
    if 'function DispatchView()' in line:
        start = i
        brace_count = line.count('{') - line.count('}')
        continue
    if start is not None:
        brace_count += line.count('{') - line.count('}')
        if brace_count <= 0:
            end = i + 1
            break

print(f'DispatchView: lines {start+1} to {end}')

# Read new DispatchView from file
with open('scripts/new_dispatch.txt', 'r') as f:
    new_dispatch = f.read()

# Replace
new_lines = lines[:start] + [new_dispatch + '\n'] + lines[end:]

with open('src/app/page.tsx', 'w') as f:
    f.writelines(new_lines)

print(f'Replaced. New file has {len(new_lines)} lines')
