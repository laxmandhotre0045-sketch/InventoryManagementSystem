import pdfplumber
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
files = [
    r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_1 .pdf',
    r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_2.pdf',
]

for f in files:
    print('FILE', f)
    with pdfplumber.open(f) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            print(' PAGE', i, 'width', page.width, 'height', page.height)
            text = page.extract_text()
            if text:
                lines = [line for line in text.splitlines() if line.strip()]
                print('  text lines', len(lines))
                print('  first 10 lines:')
                for line in lines[:10]:
                    print('   ', line)
            else:
                print('  no text')
            tables = page.extract_tables()
            print('  tables extracted:', len(tables))
            for ti, table in enumerate(tables, start=1):
                print('   table', ti, 'rows', len(table))
                for row in table[:5]:
                    print('    ', row)
            words = page.extract_words()
            print('  words', len(words))
            rows = defaultdict(list)
            for w in words:
                key = round(w['doctop'] / 3) * 3
                rows[key].append(w)
            row_keys = sorted(rows)
            print('  row groups', len(row_keys))
            for rk in row_keys[:10]:
                row = rows[rk]
                row_text = ' '.join([w['text'] for w in sorted(row, key=lambda w: w['x0'])])
                print(f'   y={rk} count={len(row)} text={row_text[:200]}')
            print('---')
