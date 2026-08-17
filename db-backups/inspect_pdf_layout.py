import pdfplumber

f = r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_1 .pdf'
with pdfplumber.open(f) as pdf:
    page = pdf.pages[0]
    print('width', page.width, 'height', page.height)
    print('text:')
    print(page.extract_text())
    print('words:')
    words = page.extract_words()
    for w in words[:100]:
        print(w)
    print('... total', len(words))
