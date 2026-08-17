import pdfplumber

files = [
    r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_1 .pdf',
    r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_2.pdf',
]

for f in files:
    print('FILE', f)
    with pdfplumber.open(f) as pdf:
        print('PAGES', len(pdf.pages))
        for i, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            print(' PAGE', i, 'TABLES', len(tables))
            for j, table in enumerate(tables, start=1):
                rows = len(table)
                cols = max(len(r) for r in table if r)
                print('  TABLE', j, 'ROWS', rows, 'COLS', cols)
                for row in table[:3]:
                    print('   ', row)
