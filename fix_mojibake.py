import re

def fix(contents):
    # All common mojibake replacements (Windows-1252/UTF-8 swap)
    replacements = [
        ('â€”', '—'),
        ('â€“', '–'),
        ('â€˜', '‘'),
        ('â€™', '’'),
        ('â€œ', '“'),
        ('â€�', '”'),
        ('â€¦', '…'),
        ('â€', '"'),
        ('â€¡', '‡'),
        ('â€¢', '•'),
        ('â„¢', '™'),
        ('â‚¬', '€'),
        ('â€¢', '•'),
        # Also fix English "authenticacion" if missed
        ('autenticacion', 'autenticación'),
        ('autenticacion biometrica', 'autenticación biométrica'),
    ]
    for bad, good in replacements:
        contents = contents.replace(bad, good)
    return contents

path = 'src/i18n/translations.ts'

with open(path, encoding='utf-8') as f:
    original = f.read()

fixed = fix(original)

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(fixed)

print("Done. Mojibake and common encoding artifacts replaced.")