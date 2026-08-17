import pdfplumber
import sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict

f = r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_1 .pdf'
with pdfplumber.open(f) as pdf:
    page = pdf.pages[0]
    words = page.extract_words()
    rows = defaultdict(list)
    for w in words:
        key = round(w['doctop'] / 3) * 3
        rows[key].append(w)
    keys = sorted(rows)
    for i, key in enumerate(keys[:20], start=1):
        row = sorted(rows[key], key=lambda w: w['x0'])
        print('ROW', i, 'y', key, 'len', len(row))
        for w in row:
            print(f"  x={w['x0']:.1f} text={w['text']}")
        print('---')
