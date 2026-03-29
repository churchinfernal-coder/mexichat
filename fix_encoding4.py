# Surgical line-by-line fix for Landing.tsx
with open('src/pages/Landing.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Map of line_number -> correct full line content
# (Using 1-based line numbers, converting to 0-based index)
fixes = {
    116: '            <div className="landing-hero-badge">🇲🇽 Hecho en México para el mundo</div>\n',
    188: '                        <span className="mock-time">10:33 ✓✓</span>\n',
    192: '                          <span>🎤</span>\n',
    196: '                        <span className="mock-time">10:34 ✓✓</span>\n',
    200: '                      <span>📎</span>\n',
    202: '                      <div className="mock-send-btn">➡️</div>\n',
    261: '                        <span>✏️</span>\n',
    263: '                      <div className="mock-chatlist-search">🔍 Buscar...</div>\n',
    268: '                          <span className="mock-preview">Nos vemos mañana! 🎉</span>\n',
    276: '                          <span className="mock-preview">Te envié el archivo 📎</span>\n',
    291: '                          <span className="mock-preview">🎤 Nota de voz (0:24)</span>\n',
    335: '                        <div className="mock-post-image">🏖️</div>\n',
    337: '                          <span>❤️ 24</span>\n',
    338: '                          <span>💬 8</span>\n',
    339: '                          <span>↗️ Compartir</span>\n',
}

for line_num, correct_line in fixes.items():
    idx = line_num - 1
    if idx < len(lines):
        old = lines[idx].rstrip('\n')
        print(f"  L{line_num}: {old[:60]}...")
        print(f"     -> {correct_line.rstrip()[:60]}...")
        lines[idx] = correct_line

# Also fix remaining mojibake in other lines (Spanish chars that got double-encoded)
import re
for i, line in enumerate(lines):
    # Fix remaining Ã¡ -> á, Ã© -> é, etc (Latin-1 double-encoded)
    original = line
    line = line.replace('\u00c3\u00a1', 'á')   # Ã¡ -> á
    line = line.replace('\u00c3\u00a9', 'é')   # Ã© -> é  
    line = line.replace('\u00c3\u00ad', 'í')   # Ã­ -> í
    line = line.replace('\u00c3\u00b3', 'ó')   # Ã³ -> ó
    line = line.replace('\u00c3\u00ba', 'ú')   # Ãº -> ú
    line = line.replace('\u00c3\u00b1', 'ñ')   # Ã± -> ñ
    line = line.replace('\u00c3\u0091', 'Ñ')   # Ã' -> Ñ
    line = line.replace('\u00c3\u0089', 'É')   # Ã‰ -> É
    line = line.replace('\u00c3\u0081', 'Á')   # Ã -> Á
    line = line.replace('\u00c3\u008d', 'Í')   # Ã -> Í
    line = line.replace('\u00c3\u0093', 'Ó')   # Ã" -> Ó
    line = line.replace('\u00c3\u009a', 'Ú')   # Ãš -> Ú
    
    # Fix replacement char sequences
    line = re.sub(r'\ufffd+[^\s<]*', '', line)  # Remove orphaned replacement chars
    line = re.sub(r'ï¿½[^\s<]*', '', line)       # Remove ï¿½ sequences
    line = re.sub(r'ðŸ\S+', lambda m: fix_utf8_emoji(m.group(0)), line)
    
    if line != original:
        lines[i] = line

# Also fix line 56 (keywords meta with deep mojibake)  
for i, line in enumerate(lines):
    if 'keywords' in line and ('ÃƒÂ' in line or 'Ãƒ' in line or 'â€' in line):
        lines[i] = '        <meta name="keywords" content="mexichat, mensajería segura, chat privado, llamadas gratis, videollamadas HD, mensajería cifrada, chat mexico, app mexicana, mexivanza, comunidad mexicana, pagos móviles, chat encriptado, alternativa whatsapp" />\n'
        print(f"  Fixed L{i+1}: keywords meta tag")

# Fix line 307 too
for i, line in enumerate(lines):
    if 'squeda instant' in line or 'búsqueda' in line.lower():
        if 'Ã' in line:
            lines[i] = line.replace('bÃºsqueda', 'búsqueda').replace('instantÃ¡nea', 'instantánea')
            print(f"  Fixed L{i+1}: búsqueda instantánea")


def fix_utf8_emoji(s):
    """Try to decode mis-displayed UTF-8 emoji bytes"""
    try:
        return s.encode('latin-1').decode('utf-8')
    except:
        return s

# Re-process emoji fixes
for i, line in enumerate(lines):
    if 'ðŸ' in line:
        try:
            # These are UTF-8 bytes displayed as latin-1
            fixed = ''
            j = 0
            chars = line
            while j < len(chars):
                if ord(chars[j]) > 127:
                    # Collect consecutive high bytes
                    high_bytes = b''
                    while j < len(chars) and ord(chars[j]) > 127:
                        high_bytes += bytes([ord(chars[j]) & 0xFF])
                        j += 1
                    try:
                        fixed += high_bytes.decode('utf-8')
                    except:
                        fixed += chars[j-len(high_bytes):j]
                else:
                    fixed += chars[j]
                    j += 1
            if fixed != line:
                lines[i] = fixed
                print(f"  Emoji fix L{i+1}")
        except:
            pass

with open('src/pages/Landing.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(lines)

# Count what's left
with open('src/pages/Landing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
bad = [l for i, l in enumerate(content.split('\n')) if any(c in l for c in ['Ã', 'ï¿½', 'â€', 'ðŸ'])]
print(f"\n  Landing.tsx: {len(bad)} potentially garbled lines remaining")
for b in bad[:5]:
    print(f"    {b.strip()[:70]}")

print("\nDone!")