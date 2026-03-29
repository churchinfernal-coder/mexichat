import os, re

def fix_file_bytes(filepath, encoding='utf-8'):
    """Read file as bytes, fix bad bytes, then process as text"""
    raw = open(filepath, 'rb').read()
    
    # Remove BOM
    if raw[:3] == b'\xef\xbb\xbf':
        raw = raw[3:]
    
    # Replace lone 0x97 (Windows-1252 em-dash) with UTF-8 em-dash
    raw = raw.replace(b'\x97', b'\xe2\x80\x94')
    # Replace lone 0x96 (en-dash)
    raw = raw.replace(b'\x96', b'\xe2\x80\x93')
    # Replace lone 0x93 (left double quote)
    raw = raw.replace(b'\x93', b'\xe2\x80\x9c')
    # Replace lone 0x94 (right double quote)
    raw = raw.replace(b'\x94', b'\xe2\x80\x9d')
    # Replace lone 0x92 (right single quote/apostrophe)
    raw = raw.replace(b'\x92', b'\xe2\x80\x99')
    
    text = raw.decode('utf-8', errors='replace')
    return text

def fix_remaining(content):
    """Fix patterns that the first pass missed"""
    
    # === Mensajes.tsx patterns ===
    # The garbled "i" prefix comments are quadruple-encoded box-drawing + em-dashes
    # Pattern: iÃ†â€™Ãƒâ€šÃ‚Â¢iÃ‚Â¢ÃƒÂ¢... = ═══
    # Pattern: iÃ‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ = —
    
    # Fix header comment: MEXICHAT <garbled> ENTERPRISE
    content = re.sub(r'MEXICHAT\s+i[^\n]+ENTERPRISE', 'MEXICHAT — ENTERPRISE', content)
    content = re.sub(r'orchestrator\s+i[^\n]+all\s+logic', 'orchestrator — all logic', content)
    
    # Fix section divider comments (lines that are just garbled box chars)
    # These are // iÃ†â€™... lines = section separators
    content = re.sub(r'//\s*i[\xc0-\xff][^\n]{10,}(?=\n)', '// ──────────────────────────────', content)
    
    # Fix // COMPONENTS iÃ‚... — existing/new
    content = re.sub(r'//\s*COMPONENTS\s+i[^\n]+existing', '// COMPONENTS — existing', content)
    content = re.sub(r'//\s*COMPONENTS\s+i[^\n]+v8 new', '// COMPONENTS — v8 new', content)
    content = re.sub(r'//\s*HOOKS\s+i[^\n]+existing', '// HOOKS — existing', content)
    content = re.sub(r'//\s*HOOKS\s+i[^\n]+v8 new', '// HOOKS — v8 new', content)
    
    # Fix {/* iÃ†... */} section comments in JSX
    content = re.sub(r'\{/\*\s*i[\xc0-\xff][^\n]*\*/\}', '{/* ────────── */}', content)
    
    # Fix inline garbled text
    content = re.sub(r"i[\xc0-\xff][^\x00-\x7f]{5,}ltima vez visto", "Ultima vez visto", content)
    content = re.sub(r"i[\xc0-\xff][^\x00-\x7f]{5,}ltima actividad", "Ultima actividad", content)
    
    # Fix notification preview garbled emoji
    content = re.sub(r":\s*'i[\xc0-\xff][^\x00-\x7f]{3,}'", ": '📩 Nuevo mensaje'", content)
    
    # Fix archived text
    content = re.sub(r":\s*`i[\xc0-\xff][^\x00-\x7f]{3,}`", ": `📦 Archivados`", content)
    
    # Fix Mostrar... line
    content = re.sub(r'Mostr[^\x00-\x7f]+', 'Mostrar', content)
    
    # === Landing.tsx remaining patterns ===
    # Fix Mexico flag emoji (hero badge)
    content = re.sub(r'[\xc0-\xff][\x80-\xff]{2,20}\s*Hecho en', '🇲🇽 Hecho en', content)
    
    # Fix airplane emoji
    content = re.sub(r'aeropuerto\s*[\xc0-\xff][\x80-\xff]{2,10}', 'aeropuerto ✈️', content)
    
    # Fix send button arrow
    content = re.sub(r'mock-send-btn">[\xc0-\xff][\x80-\xff]{2,10}<', 'mock-send-btn">➡️<', content)
    
    # Fix edit icon
    content = re.sub(r'<span>[\xc0-\xff][\x80-\xff]{2,10}</span>\s*</div>\s*<div className="mock-chatlist"', '<span>✏️</span></div><div className="mock-chatlist"', content)
    
    # Fix party/celebration emoji  
    content = re.sub(r'mañana!\s*[\xc0-\xff][\x80-\xff]{2,10}<', 'mañana! 🎉<', content)
    
    # Fix file/document emoji
    content = re.sub(r'archivo\s*[\xc0-\xff][\x80-\xff]{2,10}<', 'archivo 📎<', content)
    
    # Fix microphone emoji
    content = re.sub(r'>[\xc0-\xff][\x80-\xff]{2,10}\s*Nota de voz', '>🎤 Nota de voz', content)
    
    # Fix heart emoji
    content = re.sub(r'>[\xc0-\xff][\x80-\xff]{2,15}\s*24<', '>❤️ 24<', content)
    
    # Fix speech bubble
    content = re.sub(r'>[\xc0-\xff][\x80-\xff]{2,10}\s*8<', '>💬 8<', content)
    
    # Fix any remaining garbled-only spans
    content = re.sub(r'<span>[\xc0-\xff][\x80-\xff]{2,15}</span>', '<span>📌</span>', content)
    
    return content


# Process all affected files
files = [
    'src/pages/Landing.tsx',
    'src/pages/Mensajes.tsx', 
    'src/pages/Pagos.tsx',
    'src/pages/Perfil.tsx',
    'src/pages/Auth.tsx',
    'src/contexts/AuthContext.tsx',
    'src/hooks/useVideoInteractions.ts',
]

for fp in files:
    if not os.path.exists(fp):
        continue
    try:
        text = fix_file_bytes(fp)
        text = fix_remaining(text)
        
        with open(fp, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
        
        # Count remaining
        remaining = len(re.findall(r'[\xc0-\xff][\x80-\xff]{4,}', text))
        garbled_lines = len([l for l in text.split('\n') if re.search(r'[\xc0-\xff][\x80-\xff]{4,}', l)])
        print(f"  FIXED: {fp} ({garbled_lines} garbled lines remaining)")
    except Exception as e:
        print(f"  ERROR: {fp}: {e}")

print("\nDone!")