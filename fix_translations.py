# Read raw bytes of the file
with open('src/i18n/translations.ts', 'rb') as f:
    raw = f.read()

# The file is UTF-8 on disk, but the Russian/Chinese text was DOUBLE-encoded:
# Original UTF-8 bytes -> read as Latin-1 -> saved as UTF-8
# So each original byte like D0 97 (З) became C3 90 C2 97 on disk
# We need to: decode as UTF-8 (get the Latin-1 chars) -> encode as Latin-1 (get original bytes) -> decode as UTF-8

text = raw.decode('utf-8')

# Process line by line
lines = text.split('\n')
fixed_lines = []
for i, line in enumerate(lines):
    try:
        # Try round-trip: encode to Latin-1 then decode as UTF-8
        fixed = line.encode('latin-1').decode('utf-8')
        fixed_lines.append(fixed)
    except (UnicodeEncodeError, UnicodeDecodeError):
        # Line has chars above U+00FF (already correct) or invalid sequence
        # Try fixing only the high-byte segments
        fixed_lines.append(line)

result = '\n'.join(fixed_lines)

with open('src/i18n/translations.ts', 'w', encoding='utf-8', newline='\n') as f:
    f.write(result)

# Verify
with open('src/i18n/translations.ts', 'r', encoding='utf-8') as f:
    verify = f.readlines()

# Show ru and zh sections
for i in [88,89,90,92,93,116,117,118,120,121]:
    if i < len(verify):
        print(f"  L{i+1}: {verify[i].rstrip()[:100]}")

print("\nDone!")