import pdfplumber
import sys
sys.stdout.reconfigure(encoding='utf-8')

pdfs = [
    (r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_1 .pdf', 'pdf1'),
    (r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_2.pdf', 'pdf2'),
]

for path, name in pdfs:
    print('FILE', path)
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]
        tables = page.extract_tables()
        print(' extracted tables', len(tables))
        for ti, table in enumerate(tables, start=1):
            print(' table', ti, 'rows', len(table))
            if name == 'pdf1':
                block_defs = [
                    ('A', list(range(0, 8))),
                    ('B', [9,10,11,12,13,14]),
                    ('C', [16,17,18]),
                    ('D', [20,21,22,23,24]),
                ]
            else:
                block_defs = [
                    ('A', [0,1,2]),
                    ('B', [4,5,6]),
                    ('C', [8,9,10]),
                ]
            header = table[3] if name == 'pdf1' else table[3]
            print(' header cols', len(header), header)
            data_rows = table[4:]
            print(' data rows', len(data_rows))
            counts = {k:0 for k,_ in block_defs}
            for ri, row in enumerate(data_rows, start=5):
                if row is None:
                    continue
                for blk, cols in block_defs:
                    cells = [row[c].strip() if c < len(row) and row[c] else '' for c in cols]
                    if any(c for c in cells):
                        counts[blk] += 1
            print('  counts by block', counts)
            print('  total blocks', sum(counts.values()))
            print('  rows with any item', sum(1 for row in data_rows if row and any((row[c].strip() if c < len(row) and row[c] else '') for cols in [cols for _,cols in block_defs] for c in cols)))
            print('  sample row count', len(data_rows))
            for ri, row in enumerate(data_rows[:15], start=5):
                print(' row', ri, [row[c] if c < len(row) else None for c in range(0, 25)])
            print('---')
