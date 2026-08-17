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
        page = pdf.pages[0]
        words = page.extract_words()
        rows = defaultdict(list)
        for w in words:
            key = round(w['doctop'] / 3) * 3
            rows[key].append(w)
        keys = sorted(rows)
        for i,k in enumerate(keys):
            print(i+1, 'y=', k, 'count=', len(rows[k]), 'first=', ' '.join([w['text'] for w in sorted(rows[k], key=lambda w: w['x0'])])[:200])
        print('--- total rows', len(keys))
        # count data rows after header line at keys[1]
        data_rows = [k for k in keys if k > keys[1]]
        print('header y', keys[1], 'data row groups', len(data_rows))
        print()