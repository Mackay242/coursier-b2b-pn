import pypdf
r = pypdf.PdfReader('download/Etude_Messagerie_Interne_PRODESK.pdf')
w = pypdf.PdfWriter()
w.append(r)
w.add_metadata({
    '/Title': 'Etude messagerie interne PRODESK Congo',
    '/Author': 'PRODESK Congo',
    '/Creator': 'Z.ai',
    '/Subject': 'Analyse fonctionnelle et comparative'
})
w.write('download/Etude_Messagerie_Interne_PRODESK.pdf')
print('Done')
