import os

def fix_latin1_utf8(text):
    """
    Fix text where UTF-8 bytes were decoded as Latin-1.
    e.g. 'Ã©' (C3 A9 read as Latin-1) -> 'é' (proper UTF-8)
    e.g. 'ðŸ‡²ðŸ‡½' -> flag emoji
    """
    result = []
    i = 0
    chars = list(text)
    
    while i < len(chars):
        # Check if this char is a high byte (0xC0-0xFF) suggesting Latin-1 mis-decode
        cp = ord(chars[i])
        
        if cp >= 0xC0:
            # Collect consecutive high+continuation bytes
            high_bytes = bytearray()
            j = i
            while j < len(chars):
                c = ord(chars[j])
                if c >= 0x80:  # Both lead bytes (C0+) and continuation bytes (80-BF)
                    high_bytes.append(c)
                    j += 1
                else:
                    break
            
            # Try to decode this byte sequence as UTF-8
            try:
                decoded = bytes(high_bytes).decode('utf-8')
                result.append(decoded)
                i = j
            except (UnicodeDecodeError, ValueError):
                # Not valid UTF-8 sequence, keep original char
                result.append(chars[i])
                i += 1
        elif cp >= 0x80:
            # Continuation byte without lead byte - orphaned
            # Try to collect and decode
            high_bytes = bytearray()
            j = i
            while j < len(chars) and 0x80 <= ord(chars[j]) <= 0xBF:
                high_bytes.append(ord(chars[j]))
                j += 1
            # Can't decode orphaned continuation bytes, skip them
            result.append('?')
            i = j
        else:
            result.append(chars[i])
            i += 1
    
    return ''.join(result)


def process_file(filepath):
    """Process a single file, fixing Latin-1/UTF-8 encoding issues"""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    changed = False
    for i, line in enumerate(lines):
        # Check if line has any chars >= 0x80 that aren't proper UTF-8 sequences
        has_high = any(0xC0 <= ord(c) <= 0xFF for c in line)
        has_latin1_patterns = any(s in line for s in [
            '\u00c3\u00a9',  # Ã©
            '\u00c3\u00a1',  # Ã¡
            '\u00c3\u00b3',  # Ã³
            '\u00c3\u00ad',  # Ã­
            '\u00c3\u00ba',  # Ãº
            '\u00c3\u00b1',  # Ã±
            '\u00c3\u0089',  # Ã‰
            '\u00c3\u0081',  # Ã
            '\u00c3\u00b1',  # Ã±
            '\u00c3\u0091',  # Ã'
            '\u00c2\u00bf',  # Â¿
            '\u00c2\u00a1',  # Â¡
            '\u00c3\u00bc',  # Ã¼
            '\u00c3\u00af',  # Ã¯
            '\u00c3\u00a0',  # Ã 
            '\u00c2',        # Â
            '\u00c3',        # Ã
            '\u00c4',        # Ä
            '\u00c5',        # Å
            '\u00d0',        # Ð
            '\u00ef\u00bf\u00bd',  # ï¿½
        ])
        
        if has_high or has_latin1_patterns:
            fixed = fix_latin1_utf8(line)
            if fixed != line:
                lines[i] = fixed
                changed = True
    
    if changed:
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.writelines(lines)
    
    return changed


# Process all source files
count = 0
for root, dirs, files in os.walk('src'):
    # Skip node_modules
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for fname in files:
        if fname.endswith(('.tsx', '.ts', '.css', '.js')):
            fp = os.path.join(root, fname)
            try:
                if process_file(fp):
                    # Verify
                    with open(fp, 'r', encoding='utf-8') as f:
                        content = f.read()
                    bad_count = sum(1 for c in content if 0xC0 <= ord(c) <= 0xFF and c not in 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ')
                    print(f"  FIXED: {fp}")
                    count += 1
            except Exception as e:
                print(f"  ERROR: {fp}: {e}")

# Also process index.html
if os.path.exists('index.html'):
    if process_file('index.html'):
        print(f"  FIXED: index.html")
        count += 1

print(f"\n  Total files fixed: {count}")
print("  Done!")