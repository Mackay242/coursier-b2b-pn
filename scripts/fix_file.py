with open('src/app/page.tsx', 'r') as f:
    lines = f.readlines()
    # Keep first 2637 lines
    with open('src/app/page.tsx', 'w') as f:
        f.writelines(lines[:2637])
    print(f'Kept 2637 lines')
