import os, re, glob

def fix_encoding(content):
    """Fix triple-encoded UTF-8 mojibake back to clean UTF-8"""
    
    # === SECTION COMMENTS (corrupted box-drawing chars) ===
    # Match any {/* <garbled> WORD <garbled> */} pattern
    content = re.sub(r'\{/\*\s*[^\x00-\x7F]+\s*(NAV)\s*[^\x00-\x7F]+\s*\*/\}', r'{/* -- NAV -- */}', content)
    content = re.sub(r'\{/\*\s*[^\x00-\x7F]+\s*(HERO)\s*[^\x00-\x7F]+\s*\*/\}', r'{/* -- HERO -- */}', content)
    content = re.sub(r'\{/\*\s*[^\x00-\x7F]+\s*(APP SCREENS SHOWCASE)\s*[^\x00-\x7F]+\s*\*/\}', r'{/* -- APP SCREENS SHOWCASE -- */}', content)
    content = re.sub(r'\{/\*\s*[^\x00-\x7F]+\s*(FEATURES)\s*[^\x00-\x7F]+\s*\*/\}', r'{/* -- FEATURES -- */}', content)
    content = re.sub(r'\{/\*\s*[^\x00-\x7F]+\s*(PRIVACY)\s*[^\x00-\x7F]+\s*\*/\}', r'{/* -- PRIVACY -- */}', content)
    content = re.sub(r'\{/\*\s*[^\x00-\x7F]+\s*(DOWNLOAD)\s*[^\x00-\x7F]+\s*\*/\}', r'{/* -- DOWNLOAD -- */}', content)
    content = re.sub(r'\{/\*\s*[^\x00-\x7F]+\s*(FOOTER)\s*[^\x00-\x7F]+\s*\*/\}', r'{/* -- FOOTER -- */}', content)
    
    # Match // <garbled>\n// WORD <garbled>\n// <garbled> comment blocks
    content = re.sub(r'//\s*[^\x00-\x7F]{5,}\n//\s*(COMPONENTS)\s*[^\x00-\x7F]+[^\n]*\n//\s*[^\x00-\x7F]{5,}', r'// ----------\n// \1\n// ----------', content)
    content = re.sub(r'//\s*[^\x00-\x7F]{5,}\n//\s*(HOOKS)\s*[^\x00-\x7F]+[^\n]*\n//\s*[^\x00-\x7F]{5,}', r'// ----------\n// \1\n// ----------', content)
    content = re.sub(r'//\s*[^\x00-\x7F]{5,}\n//\s*[^\x00-\x7F]{5,}', r'// ----------\n// ----------', content)
    
    # Match {/* <garbled> ... */} generic (for Mensajes section dividers)  
    content = re.sub(r'\{/\*\s*[^\x00-\x7F]{8,}[^\n]*\*/\}', r'{/* ---------- */}', content)
    
    # Match // <garbled> standalone comment lines
    content = re.sub(r'//\s*[^\x00-\x7F]{8,}[^\n]*', r'// ----------', content)
    
    # === SPANISH CHARACTERS ===
    # These are the specific mojibake patterns for accented chars
    pairs = [
        # i + garbled = Ú (triple encoded)
        (r'i[^\x00-\x7F]{3,12}a\b(?!\s*\()', 'ía'),  # Too aggressive, skip
    ]
    
    # Direct string replacements (safer than regex for mojibake)
    replacements = {
        # Spanish accented vowels (from ÃƒÆ'Ã‚Â + char)
        'Mensajer\u00c3\u0086\u2019\u00c3\u201a\u00c2\u00ada': 'Mensajer\u00eda',
        'mensajer\u00c3\u0086\u2019\u00c3\u201a\u00c2\u00ada': 'mensajer\u00eda',
    }
    
    # Broader pattern: any sequence of 3+ non-ASCII chars between ASCII text
    # Fix known Spanish words with mojibake
    spanish_fixes = [
        (r'Mensajer[^\x00-\x7F]+a\s', 'Mensajería '),
        (r'mensajer[^\x00-\x7F]+a\s', 'mensajería '),
        (r'mensajer[^\x00-\x7F]+a,', 'mensajería,'),
        (r'Mar[^\x00-\x7F]+a\sGarc[^\x00-\x7F]+a', 'María García'),
        (r'Garc[^\x00-\x7F]+a', 'García'),
        (r'L[^\x00-\x7F]+pez', 'López'),
        (r'emoci[^\x00-\x7F]+n!!', 'emoción!!'),
        (r'emoci[^\x00-\x7F]+n', 'emoción'),
        (r'Ubicaci[^\x00-\x7F]+n', 'Ubicación'),
        (r'ubicaci[^\x00-\x7F]+n', 'ubicación'),
        (r'all[^\x00-\x7F]+\s', 'allá '),
        (r'Mam[^\x00-\x7F]+:', 'Mamá:'),
        (r'ma[^\x00-\x7F]+ana!', 'mañana!'),
        (r'ma[^\x00-\x7F]+ana\b', 'mañana'),
        (r'envi[^\x00-\x7F]+\sel', 'envié el'),
        (r'envi[^\x00-\x7F]+\s', 'envié '),
        (r'Qu[^\x00-\x7F]+\semoci', 'Qué emoci'),
        (r'M[^\x00-\x7F]+xico', 'México'),
        (r'b[^\x00-\x7F]+squeda', 'búsqueda'),
        (r'instant[^\x00-\x7F]+nea', 'instantánea'),
        (r'd[^\x00-\x7F]+as\b', 'días'),
        (r'S[^\x00-\x7F]+!\sAcabo', 'Sí! Acabo'),
        (r'en\sl[^\x00-\x7F]+nea', 'en línea'),
        (r'l[^\x00-\x7F]+nea\b', 'línea'),
        (r'Privadaa\s', 'Privada '),
        (r'aeropuertto', 'aeropuerto'),
        (r'\syy\s', ' y '),
        (r'\sppara\s', ' para '),
        (r'Cl[^\x00-\x7F]+sico', 'Clásico'),
        (r'[^\x00-\x7F]+ltima\svez', 'Última vez'),
        (r'[^\x00-\x7F]+ltima\sactividad', 'Última actividad'),
        (r'ltima\svez', 'Última vez'),
    ]
    
    for pattern, replacement in spanish_fixes:
        content = re.sub(pattern, replacement, content)
    
    # === EMOJIS (replace garbled multi-byte sequences) ===
    # Match isolated garbled sequences that should be emojis
    # Pattern: sequences of 3+ non-ASCII chars surrounded by tags/quotes
    emoji_context = [
        (r'>([^\x00-\x7F]{4,20})\s*Hecho en', '>🇲🇽 Hecho en'),
        (r'llegaste\?\s*[^\x00-\x7F]+', 'llegaste? 👋'),
        (r'[^\x00-\x7F]+\sTe mando mi ubicaci', '🎉 Te mando mi ubicaci'),
        (r'para\sall[^\x00-\x7F]+\s[^\x00-\x7F]+', 'para allá 🚗💨'),
        (r'Veracruzzzz\s[^\x00-\x7F]+', 'Veracruzzzz 🤩'),
        (r'>([^\x00-\x7F]{3,8})</div>\s*<div\sclassName="mock-send', '>➡️</div><div className="mock-send'),
        (r'"mock-back">[^\x00-\x7F]+<', '"mock-back">←<'),
        (r'"mock-map">[^\x00-\x7F]+<', '"mock-map">📍<'),
        (r'"mock-home-settings">[^\x00-\x7F]+<', '"mock-home-settings">⚙️<'),
        (r'"mock-chatlist-search">[^\x00-\x7F]+\sBuscar', '"mock-chatlist-search">🔍 Buscar'),
        (r'"mock-post-image">[^\x00-\x7F]+<', '"mock-post-image">🏖️<'),
        (r'"mock-icon-circle blue">[^\x00-\x7F]+<', '"mock-icon-circle blue">💬<'),
        (r'"mock-icon-circle green">[^\x00-\x7F]+<', '"mock-icon-circle green">💲<'),
        (r'"mock-icon-circle purple">[^\x00-\x7F]+<', '"mock-icon-circle purple">🌎<'),
        (r'Nota de voz', 'Nota de voz'),
    ]
    
    for pattern, replacement in emoji_context:
        content = re.sub(pattern, replacement, content)
    
    # Replace isolated garbled emoji sequences in <span> tags
    content = re.sub(r'<span>([^\x00-\x7F]{3,20})</span>\s*<span>([^\x00-\x7F]{3,20})</span>\s*</div>\s*<div className="mock-header-icons">', 
                     '<span>📞</span><span>📹</span></div><div className="mock-header-icons">', content)
    content = re.sub(r'<span>[^\x00-\x7F]{3,15}</span>\s*</div>\s*<div className="mock-input">', 
                     '<span>🎤</span></div><div className="mock-input">', content)
    
    # Fix checkmarks (✓✓)
    content = re.sub(r'10:3[0-9]\s[^\x00-\x7F]+</span>', lambda m: m.group(0)[:5] + ' ✓✓</span>', content)
    
    # Fix remaining isolated garbled sequences in spans
    content = re.sub(r'<span>([^\x00-\x7F]{3,20})</span>', lambda m: '<span>' + guess_emoji(m.group(1)) + '</span>', content)
    
    # Fix arrows and symbols inline
    content = re.sub(r'[^\x00-\x7F]+\sGoogle Play', '▶ Google Play', content)
    content = re.sub(r'[^\x00-\x7F]+\s\{t\.landing\.download\.downloadApk\}', '⬇ {t.landing.download.downloadApk}', content)
    content = re.sub(r'[^\x00-\x7F]+\s\{t\.landing\.download\.openWebApp\}', '🌐 {t.landing.download.openWebApp}', content)
    content = re.sub(r'[^\x00-\x7F]+\sCompartir', '↗️ Compartir', content)
    content = re.sub(r'Mercado Pago\s[^\x00-\x7F]+\s', 'Mercado Pago → ', content)
    content = re.sub(r'OXXO\s[^\x00-\x7F]+\s', 'OXXO → ', content)
    
    # Fix mid-dot separator
    content = re.sub(r'<span>[^\x00-\x7F]{2,6}</span>\s*<span', '<span>·</span><span', content)
    
    # Fix copyright header garbled arrows
    content = re.sub(r'MEXICHAT\s[^\x00-\x7F]+\sENTERPRISE', 'MEXICHAT — ENTERPRISE', content)
    content = re.sub(r'orchestrator\s[^\x00-\x7F]+\sall', 'orchestrator — all', content)
    content = re.sub(r'existing\n', 'existing\n', content)
    content = re.sub(r'COMPONENTS\s[^\x00-\x7F]+\s', 'COMPONENTS — ', content)
    content = re.sub(r'HOOKS\s[^\x00-\x7F]+\s', 'HOOKS — ', content)
    
    # Fix notification text
    content = re.sub(r"content\.slice\(0,\s*100\)\s*:\s*'[^\x00-\x7F]+", "content.slice(0, 100) : '📩", content)
    
    # Fix archived chats text
    content = re.sub(r"Ocultar archivados'\s*:\s*`[^\x00-\x7F]+", "Ocultar archivados' : `📦", content)
    
    # Fix hearts
    content = re.sub(r'[^\x00-\x7F]{2,6}\s*24</span>', '❤️ 24</span>', content)
    
    # Clean any remaining garbled in SEO meta
    content = re.sub(r'La\smensajer[^\x00-\x7F]+a\sde\sM[^\x00-\x7F]+xico\s+para', 'La mensajería de México para', content)
    content = re.sub(r'Privada,?\s*y?\s*segura', 'Privada y segura', content)
    
    return content

def guess_emoji(garbled):
    """Try to guess emoji from garbled byte length"""
    l = len(garbled)
    if l <= 5: return '📞'
    if l <= 8: return '📹'  
    if l <= 12: return '💬'
    return '📎'

# Process files
files_to_fix = []
for pattern in ['src/pages/*.tsx', 'src/pages/*.ts', 'src/contexts/*.tsx', 'src/hooks/*.ts', 'src/services/*.ts', 'src/components/*.tsx', 'src/lib/*.ts', 'src/types/*.ts']:
    files_to_fix.extend(glob.glob(pattern))

fixed_count = 0
for filepath in files_to_fix:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()
        
        fixed = fix_encoding(original)
        
        if fixed != original:
            # Remove BOM if present
            if fixed.startswith('\ufeff'):
                fixed = fixed[1:]
            with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
                f.write(fixed)
            
            # Count remaining garbled
            remaining = len(re.findall(r'[^\x00-\x7F]{5,}', fixed))
            print(f"  FIXED: {filepath} ({remaining} garbled sequences remaining)")
            fixed_count += 1
        else:
            pass
    except Exception as e:
        print(f"  ERROR: {filepath}: {e}")

# Also fix BOM-only files
bom_files = [
    'src/components/ErrorBoundary.tsx',
    'src/contexts/AuthContext.tsx', 
    'src/hooks/useMexivanzaSections.ts',
    'src/lib/capacitor-push.ts',
    'src/services/accountDeletion.ts',
    'src/services/adminService.ts',
    'src/services/appLifecycle.ts',
    'src/types/mapbox__point-geometry.d.ts',
]
for bf in bom_files:
    if os.path.exists(bf):
        with open(bf, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        with open(bf, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        print(f"  BOM REMOVED: {bf}")

print(f"\n  Total files fixed: {fixed_count}")
print("  Done!")