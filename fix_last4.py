import os

def fix_latin1_as_utf8(filepath):
    """Read file bytes, re-interpret Latin-1-decoded-UTF-8 back to proper UTF-8"""
    raw = open(filepath, 'rb').read()
    
    # Remove BOM if present
    if raw[:3] == b'\xef\xbb\xbf':
        raw = raw[3:]
    
    # Fix lone Windows-1252 bytes
    raw = raw.replace(b'\x97', b'\xe2\x80\x94')
    raw = raw.replace(b'\x96', b'\xe2\x80\x93')
    raw = raw.replace(b'\x93', b'\xe2\x80\x9c')
    raw = raw.replace(b'\x94', b'\xe2\x80\x9d')
    raw = raw.replace(b'\x92', b'\xe2\x80\x99')
    
    # Decode as UTF-8 (it should be valid now)
    text = raw.decode('utf-8', errors='replace')
    
    # The core trick: chars like Ã© (U+00C3 U+00A9) are UTF-8 bytes
    # C3 A9 that were decoded as Latin-1 instead of UTF-8
    # Solution: encode back to Latin-1 (gets raw bytes), then decode as UTF-8
    fixed_lines = []
    changed = False
    for line in text.split('\n'):
        try:
            # Try the Latin-1 round-trip
            raw_bytes = line.encode('latin-1')
            fixed = raw_bytes.decode('utf-8')
            if fixed != line:
                changed = True
            fixed_lines.append(fixed)
        except (UnicodeEncodeError, UnicodeDecodeError):
            # Line has chars outside Latin-1 range (already proper Unicode)
            # or the bytes don't form valid UTF-8 — keep as-is
            fixed_lines.append(line)
    
    if changed:
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(fixed_lines))
        return True
    return False

files = [
    'src/components/messaging/ChatWindow.tsx',
    'src/components/messaging/GroupChatWindow.tsx',
    'src/hooks/useErrorHandler.ts',
    'src/i18n/translations.ts',
]

for fp in files:
    if os.path.exists(fp):
        try:
            if fix_latin1_as_utf8(fp):
                print(f"  FIXED: {fp}")
            else:
                print(f"  OK (no changes): {fp}")
        except Exception as e:
            print(f"  ERROR: {fp}: {e}")

print("\nDone!")