with open('src/app/page.tsx', 'r') as f:
    content = f.read()

# The PaiementView has leading spaces in the replacement text.
# Find the function and fix indentation.
import re

# Find 'function PaiementView()' and dedent the body
lines = content.split('\n')
new_lines = []
in_function = False
base_indent = None

for i, line in enumerate(lines):
    if 'function PaiementView()' in line:
        in_function = True
        new_lines.append(line)
        continue
    
    if in_function:
        # Find the next function or export
        if line.strip().startswith('// =====') or line.strip().startswith('export default'):
            in_function = False
            new_lines.append(line)
            continue
        
        # Calculate the base indent from the first non-empty line
        if base_indent is None and line.strip():
            base_indent = len(line) - len(line.lstrip())
        
        # Remove the base indent
        if base_indent and line.strip():
            if len(line) >= base_indent:
                new_lines.append('  ' + line[base_indent:])  # Add 2-space indent
            else:
                new_lines.append(line)
        elif not line.strip():
            new_lines.append(line)
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open('src/app/page.tsx', 'w') as f:
    f.write('\n'.join(new_lines))

print('Fixed indentation')