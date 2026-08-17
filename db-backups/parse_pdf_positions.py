import pdfplumber
from collections import defaultdict
import math

f = r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_1 .pdf'
with pdfplumber.open(f) as pdf:
    page = pdf.pages[0]
    words = page.extract_words()
    # group words by approximate row y coordinate
    rows = defaultdict(list)
    for w in words:
        # use doctop as row coord, bucket by 3 points
        key = round(w['doctop'] / 3) * 3
        rows[key].append(w)
    keys = sorted(rows)
    for i, key in enumerate(keys[:20], start=1):
        row = sorted(rows[key], key=lambda w: w['x0'])
        print('ROW', i, 'y', key, 'len', len(row))
        for w in row:
            print(f"  x={w['x0']:.1f} text={w['text']}")
        print('---')
