# Windows-1252 to byte mapping for the chars that differ from Latin-1
# These are the chars in the 0x80-0x9F range that Windows-1252 maps differently
cp1252_to_byte = {
    0x20AC: 0x80,  # €
    0x201A: 0x82,  # ‚
    0x0192: 0x83,  # ƒ
    0x201E: 0x84,  # „
    0x2026: 0x85,  # …
    0x2020: 0x86,  # †
    0x2021: 0x87,  # ‡
    0x02C6: 0x88,  # ˆ
    0x2030: 0x89,  # ‰
    0x0160: 0x8A,  # Š
    0x2039: 0x8B,  # ‹
    0x0152: 0x8C,  # Œ
    0x017D: 0x8E,  # Ž
    0x2018: 0x91,  # '
    0x2019: 0x92,  # '
    0x201C: 0x93,  # "
    0x201D: 0x94,  # "
    0x2022: 0x95,  # •
    0x2013: 0x96,  # –
    0x2014: 0x97,  # —
    0x02DC: 0x98,  # ˜
    0x2122: 0x99,  # ™
    0x0161: 0x9A,  # š
    0x203A: 0x9B,  # ›
    0x0153: 0x9C,  # œ
    0x017E: 0x9E,  # ž
    0x0178: 0x9F,  # Ÿ
}

def unicode_to_cp1252_bytes(text):
    """Convert Unicode string back to the CP-1252 bytes it was decoded from"""
    result = bytearray()
    for ch in text:
        cp = ord(ch)
        if cp < 0x80:
            result.append(cp)
        elif cp in cp1252_to_byte:
            result.append(cp1252_to_byte[cp])
        elif cp <= 0xFF:
            result.append(cp)
        else:
            # Character above U+00FF that's not in our CP1252 map - skip/replace
            result.append(0x3F)  # '?'
    return bytes(result)

def fix_line(line):
    """Try to reverse the Windows-1252 mis-decode"""
    try:
        raw_bytes = unicode_to_cp1252_bytes(line)
        return raw_bytes.decode('utf-8')
    except (UnicodeDecodeError, ValueError):
        return None

with open('src/i18n/translations.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

changed = 0
for i, line in enumerate(lines):
    # Only try to fix lines that have the garbled patterns
    has_garbled = any(ord(c) in (0x00D0, 0x00D1, 0x0192, 0x2026) for c in line)
    if not has_garbled:
        # Also check for Chinese garbled (å, æ, ç, è patterns)
        has_garbled = any(c in line for c in ['åŠ', 'ä¿', 'å–', 'èŠ', 'ç¾', 'æ"¯', 'ç¤¾', 'è®¾', 'åŠŸ', 'éš', 'å¢¨'])
    
    if has_garbled:
        fixed = fix_line(line)
        if fixed and fixed != line:
            lines[i] = fixed
            changed += 1
            print(f"  Fixed L{i+1}: {fixed.rstrip()[:80]}")

with open('src/i18n/translations.ts', 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(lines)

print(f"\n  {changed} lines fixed")
print("  Done!")