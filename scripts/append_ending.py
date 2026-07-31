with open('src/app/page.tsx', 'a') as f:
    lines = f.readlines()
    print(f'File has {len(lines)} lines')
    with open('src/app/page.tsx', 'w') as f:
        f.truncate(len(lines) - 2637)
        f.write(ENDING)
        print(f'Truncated to {len(f.readlines())} lines')
