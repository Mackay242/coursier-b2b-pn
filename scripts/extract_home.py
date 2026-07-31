lines = open('src/app/page.tsx').readlines()
with open('/tmp/test_home2.tsx', 'w') as f:
    f.write("'use client';\n\n")
    for l in lines[:2496]:
        f.write(l)
    f.write("\n// HOME FUNCTION ONLY TEST\n\n")
    for l in lines[2496:2679]:
        f.write(l)
    f.write("\nexport {};\n")