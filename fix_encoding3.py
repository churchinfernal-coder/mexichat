import re

# === LANDING.TSX final fixes ===
with open('src/pages/Landing.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

fixes_landing = {
    116: ('landing-hero-badge">', 'landing-hero-badge">🇲🇽 Hecho en M'),
    173: ('<p>S', '<p>Sí! Acabo de llegar al aeropuerto ✈️</p>\n'),
    188: ('<p>Perfecto', '<p>Perfecto! Ya voy para allá 🚗💨</p>\n'),
    203: ('mock-send-btn">', 'mock-send-btn">➡️</div>\n'),
    262: ('<span>', '<span>✏️</span>\n'),
    269: ('mock-preview">', 'mock-preview">Nos vemos mañana! 🎉</span>\n'),
    277: ('mock-preview">', 'mock-preview">Te envié el archivo 📎</span>\n'),
    292: ('mock-preview">', 'mock-preview">🎤 Nota de voz (0:24)</span>\n'),
    338: ('<span>', '<span>❤️ 24</span>\n'),
    339: ('<span>', '<span>💬 8</span>\n'),
}

for line_num, (_, replacement) in fixes_landing.items():
    idx = line_num - 1
    if idx < len(lines):
        old = lines[idx]
        # Get the leading whitespace
        ws = old[:len(old) - len(old.lstrip())]
        lines[idx] = ws + replacement

with open('src/pages/Landing.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(lines)

# Verify Landing
with open('src/pages/Landing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
remaining = len([l for l in content.split('\n') if re.search(r'[\xc0-\xff][\x80-\xbf]{3,}.*[\xc0-\xff][\x80-\xbf]{3,}', l)])
print(f"  Landing.tsx: {remaining} garbled lines remaining")


# === MENSAJES.TSX final fixes ===
with open('src/pages/Mensajes.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Line 427: iÚÚltima -> Última
content = content.replace("'iÚÚltima vez visto'", "'Última vez visto'")

# Line 447: Mostrar iÃ†... -> Mostrar
content = re.sub(r'Mostrar\s+i[^\x00-\x7f][^\n]*', 'Mostrar</div>', content)

# Line 512: iÚltima actividad -> Última actividad
content = content.replace('iÚltima actividad:', 'Última actividad:')

# Line 557: garbled emoji in span -> notification bell
content = re.sub(r"fontWeight:\s*700\s*\}}>i[^\x00-\x7f][^<]*<", "fontWeight: 700 }}>🔔<", content)

# Lines 1015, 1022, 1048: garbled notification emoji -> clean
content = re.sub(r":\s*'i[\xc0-\xff][^']*'", ": '📩 Nuevo mensaje'", content)
content = re.sub(r":\s*'i[\xc3-\xff][^']*'", ": '📩 Nuevo mensaje'", content)

# Fix backtick versions too
content = re.sub(r":\s*`i[\xc0-\xff][^`]*`", ": `📩 Nuevo mensaje`", content)

# Line 1661: archived garbled emoji
content = re.sub(r":\s*`i[^\x00-\x7f][^`]*Archivados[^`]*`", ": `📦 Archivados`", content)
# Broader match if above misses
content = re.sub(r"'Ocultar archivados'\s*:\s*`[^`]*i[\xc0-\xff][^`]*`", "'Ocultar archivados' : `📦 Archivados`", content)

with open('src/pages/Mensajes.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

# Verify Mensajes
remaining = len([l for l in content.split('\n') if re.search(r'i[\xc0-\xff][\x80-\xbf]', l)])
print(f"  Mensajes.tsx: {remaining} garbled lines remaining")

print("\nDone!")