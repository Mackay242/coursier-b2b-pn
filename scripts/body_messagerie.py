# -*- coding: utf-8 -*-
"""Corps du rapport : Etude sur l'utilite d'une messagerie interne pour PRODESK Congo."""

import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font setup ──
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
# Noto Sans SC skipped (variable font not ReportLab-compatible); NotoSerifSC used as fallback
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
# registerFontFamily('Noto Sans SC', normal='Noto Sans SC', bold='Noto Sans SC Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ── Font fallback ──
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'skills', 'pdf', 'scripts'))
try:
    from pdf import install_font_fallback
    install_font_fallback()
except ImportError:
    pass

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f7f7f6')
SECTION_BG    = colors.HexColor('#ebebea')
CARD_BG       = colors.HexColor('#eeede9')
TABLE_STRIPE  = colors.HexColor('#f3f2f1')
HEADER_FILL   = colors.HexColor('#685e41')
COVER_BLOCK   = colors.HexColor('#5d553c')
BORDER        = colors.HexColor('#d3cebd')
ICON          = colors.HexColor('#a79356')
ACCENT        = colors.HexColor('#8c7226')
ACCENT_2      = colors.HexColor('#60a6be')
TEXT_PRIMARY   = colors.HexColor('#191816')
TEXT_MUTED     = colors.HexColor('#8c8982')
SEM_SUCCESS   = colors.HexColor('#3f8256')
SEM_WARNING   = colors.HexColor('#9c8048')
SEM_ERROR     = colors.HexColor('#b0554d')
SEM_INFO      = colors.HexColor('#4c6a87')

# ── Styles ──
PAGE_W, PAGE_H = A4
LEFT_M = 60
RIGHT_M = 60
TOP_M = 50
BOT_M = 50
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

body_style = ParagraphStyle(
    name='Body', fontName='FreeSerif', fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, spaceAfter=8, textColor=TEXT_PRIMARY,
)
body_fr = ParagraphStyle(
    name='BodyFR', fontName='FreeSerif', fontSize=10.5, leading=17,
    alignment=TA_LEFT, spaceAfter=8, textColor=TEXT_PRIMARY,
)

h1_style = ParagraphStyle(
    name='H1', fontName='FreeSerif-Bold', fontSize=20, leading=28,
    spaceAfter=12, spaceBefore=24, textColor=HEADER_FILL,
)
h2_style = ParagraphStyle(
    name='H2', fontName='FreeSerif-Bold', fontSize=14, leading=20,
    spaceAfter=8, spaceBefore=16, textColor=ACCENT,
)
h3_style = ParagraphStyle(
    name='H3', fontName='FreeSerif-Bold', fontSize=12, leading=17,
    spaceAfter=6, spaceBefore=12, textColor=TEXT_PRIMARY,
)
bullet_style = ParagraphStyle(
    name='Bullet', fontName='FreeSerif', fontSize=10.5, leading=17,
    alignment=TA_LEFT, spaceAfter=4, textColor=TEXT_PRIMARY,
    leftIndent=18, bulletIndent=6,
)
table_header_style = ParagraphStyle(
    name='TableHeader', fontName='FreeSerif-Bold', fontSize=9.5, leading=13,
    alignment=TA_CENTER, textColor=colors.white,
)
table_cell_style = ParagraphStyle(
    name='TableCell', fontName='FreeSerif', fontSize=9, leading=13,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY,
)
table_cell_center = ParagraphStyle(
    name='TableCellCenter', fontName='FreeSerif', fontSize=9, leading=13,
    alignment=TA_CENTER, textColor=TEXT_PRIMARY,
)
quote_style = ParagraphStyle(
    name='Quote', fontName='FreeSerif-Italic', fontSize=10.5, leading=17,
    alignment=TA_LEFT, spaceAfter=8, spaceBefore=8,
    textColor=TEXT_MUTED, leftIndent=24, borderPadding=8,
)

# ── TOC styles ──
toc_level0 = ParagraphStyle(
    name='TOC0', fontName='FreeSerif-Bold', fontSize=12, leading=20,
    leftIndent=0, spaceBefore=6, spaceAfter=2, textColor=HEADER_FILL,
)
toc_level1 = ParagraphStyle(
    name='TOC1', fontName='FreeSerif', fontSize=10.5, leading=17,
    leftIndent=18, spaceBefore=2, spaceAfter=2, textColor=TEXT_PRIMARY,
)

# ── TocDocTemplate ──
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ── Helpers ──
def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=12, spaceBefore=12)

def make_table(headers, rows, col_widths=None):
    """Build a styled table with Paragraph cells."""
    if col_widths is None:
        col_widths = [CONTENT_W / len(headers)] * len(headers)
    header_cells = [Paragraph(h, table_header_style) for h in headers]
    data = [header_cells]
    for row in rows:
        data.append([Paragraph(str(c), table_cell_style) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

# ── Page number ──
def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(PAGE_W / 2, 25, str(doc.page))
    canvas.restoreState()

def add_page_number_skip_first(canvas, doc):
    if doc.page > 1:
        add_page_number(canvas, doc)

# ── Build story ──
OUTPUT = '/home/z/my-project/download/Etude_Messagerie_Interne_PRODESK.pdf'
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

doc = TocDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOT_M,
    title="Etude sur l'utilite d'une messagerie interne pour PRODESK Congo",
    author='PRODESK Congo',
    subject='Analyse fonctionnelle et comparative de la messagerie interne',
)

story = []

# ── TOC ──
toc = TableOfContents()
toc.levelStyles = [toc_level0, toc_level1]
story.append(Paragraph('<b>Table des matieres</b>', ParagraphStyle(
    name='TOCTitle', fontName='FreeSerif-Bold', fontSize=22, leading=30,
    spaceAfter=20, textColor=HEADER_FILL,
)))
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# CHAPTER 1 : INTRODUCTION
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('Introduction', h1_style, 0))
story.append(Paragraph(
    "Dans le contexte numerique actuel, la communication interne constitue un pilier fondamental "
    "de toute organisation qui souhaite maintenir un niveau de service eleve et une coordination "
    "efficace entre ses differents acteurs. PRODESK Congo, la plateforme de services administratifs "
    "integree dans l'application CoursierB2B, accompagne des clients dans leurs demarches aupres "
    "d'institutions publiques et privees : CNSS, DGI, SFEC, gestion documentaire, secretariat, "
    "et bureau digital. Chaque jour, des dizaines de requetes transitent entre les clients, les agents "
    "de terrain et les administrateurs, yet actuellement aucun canal de communication interne ne permet "
    "un suivi structure de ces echanges.",
    body_fr
))
story.append(Paragraph(
    "L'objectif de cette etude est d'analyser en profondeur l'utilite d'integrer un systeme de "
    "messagerie interne au sein de la plateforme PRODESK Congo. Nous examinerons les besoins "
    "specifiques de l'application, comparerons les approches de messagerie adoptees par des systemes "
    "similaires sur le marche (helpdesks, ERP collaboratifs, plateformes B2B de services), et "
    "formulerons une recommandation eclairee sur la pertinence et la forme que devrait prendre "
    "cette fonctionnalite. Cette analyse s'inscrit dans une demarche d'amelioration continue de "
    "l'experience utilisateur et de l'efficacite operationnelle de la plateforme.",
    body_fr
))
story.append(Paragraph(
    "Actuellement, les echanges entre les parties prenantes de CoursierB2B s'effectuent "
    "exclusivement via des canaux externes : appels telephoniques, messages WhatsApp, et "
    "notifications basiques dans l'application. Cette fragmentation des canaux de communication "
    "engendre des pertes d'information, des delais de traitement plus longs et une difficulte "
    "a retracer l'historique des echanges lies a chaque dossier. L'integration d'une messagerie "
    "interne vise precisement a resoudre ces problematiques en centralisant la communication "
    "au sein meme de la plateforme.",
    body_fr
))

# ═══════════════════════════════════════════════════════════════
# CHAPTER 2 : CONTEXTE ET BESOINS DE PRODESK CONGO
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('Contexte et besoins de PRODESK Congo', h1_style, 0))

story.append(add_heading('Architecture actuelle de la plateforme', h2_style, 1))
story.append(Paragraph(
    "CoursierB2B est une application Next.js hebergee sur Vercel, utilisant PostgreSQL comme base "
    "de donnees via Neon et Prisma ORM. La plateforme gere des services administratifs diversifies "
    "a travers six modules principaux : le Bureau Digital, les prestations CNSS, la fiscalite (DGI), "
    "les formalites SFEC, la gestion documentaire et le secretariat. Chaque module possede ses "
    "propres workflows, formulaires et etats de traitement des dossiers, ce qui genere un volume "
    "important d'interactions entre les trois types d'utilisateurs : les administrateurs, les agents "
    "et les clients.",
    body_fr
))
story.append(Paragraph(
    "Les administrateurs supervisent l'ensemble des operations, assignent les taches aux agents "
    "et valident les etapes critiques. Les agents executent les demarches aupres des institutions "
    "partenaires et mettent a jour l'avancement des dossiers. Les clients, quant a eux, soumettent "
    "leurs requetes, fournissent les documents necessaires et suivent le progres de leurs demandes "
    "en temps reel. Cette triangulation des roles cree un besoin naturel de communication "
    "bidirectionnelle et parfois tridirectionnelle pour chaque dossier traite.",
    body_fr
))

story.append(add_heading('Limites des canaux de communication actuels', h2_style, 1))
story.append(Paragraph(
    "Le systeme actuel repose sur plusieurs canaux de communication independants les uns des "
    "autres. Le bot WhatsApp, par exemple, permet d'envoyer des notifications sortantes aux "
    "clients concernant l'etat de leurs dossiers, mais il ne supporte pas les echanges "
    "conversationnels. Les appels telephoniques restent le moyen principal pour les clarifications "
    "entre agents et clients, yet aucune trace de ces echanges n'est conservee dans le systeme. "
    "Les notifications in-app se limitent a des alertes ponctuelles sans possibilite de reponse "
    "ou de suivi dans le temps.",
    body_fr
))
story.append(Paragraph(
    "Cette fragmentation presente plusieurs inconvenients majeurs. Premierement, l'absence de "
    "tracabilite : lorsqu'un agent appelle un client pour demander un document supplementaire, "
    "cet echange n'est enregistre nulle part dans le dossier. Si un autre agent doit reprendre "
    "le dossier, il n'a aucun historique des communications precedentes. Deuxiemement, la lenteur "
    "de traitement : les allers-retours entre canaux (notification WhatsApp, appel telephonique, "
    "retour dans l'application) ralentissent considerablement le temps de resolution des dossiers. "
    "Troisiemement, le manque de securite : les echanges sensibles contenant des informations "
    "personnelles ou financieres transitent par des canaux non securises et non enregistres.",
    body_fr
))

story.append(add_heading('Identification des besoins fonctionnels', h2_style, 1))
story.append(Paragraph(
    "L'analyse des workflows existants reveale plusieurs besoins fonctionnels specifiques qu'une "
    "messagerie interne devrait couvrir pour PRODESK Congo. Le besoin le plus critique concerne "
    "la communication dossier : chaque echange lie a un dossier specifique (demande CNSS, "
    "declaration fiscale, enregistrement SFEC) devrait etre automatiquement associe a ce dossier, "
    "permettant ainsi a tout intervenant de consulter l'historique complet des communications. "
    "Ensuite, la communication inter-service : les agents du Bureau Digital doivent pouvoir "
    "echanger avec ceux du service fiscalite lorsqu'un dossier necessite des interventions "
    "croisees, par exemple lorsqu'une creation d'entreprise implique a la fois des formalites "
    "SFEC et des demarches DGI.",
    body_fr
))
story.append(Paragraph(
    "Un troisieme besoin concerne les notifications interactives : plutot que de simples alertes, "
    "les utilisateurs devraient pouvoir repondre directement depuis la notification, poser une "
    "question ou confirmer une information. Enfin, la communication admin-agent necessite un "
    "canal dedie pour les instructions internes, les validations et les escalades, distinct des "
    "echanges avec les clients. Ces quatre besoins constituent le socle fonctionnel sur lequel "
    "une solution de messagerie doit etre construite pour repondre aux exigences de PRODESK Congo.",
    body_fr
))

# ═══════════════════════════════════════════════════════════════
# CHAPTER 3 : ETUDE COMPARATIVE DES SYSTEMES DE MESSAGERIE
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('Etude comparative des systemes de messagerie', h1_style, 0))

story.append(add_heading('Les helpdesks et plateformes de support client', h2_style, 1))
story.append(Paragraph(
    "Les plateformes de helpdesk representent la categorie de produits la plus directement "
    "comparable a la situation de PRODESK Congo. Ces systemes sont concus pour gerer les "
    "communications entre une equipe de support et des clients, avec un suivi structure par ticket "
    "et une tracabilite complete des echanges. L'etude de leurs approches de messagerie fournit "
    "des indications precieuses sur les bonnes pratiques en matiere de communication integree "
    "a un workflow de service.",
    body_fr
))

# Tableau comparatif Helpdesks
story.append(add_heading('Zendesk : la reference du secteur', h3_style, 1))
story.append(Paragraph(
    "Zendesk est reconnu comme le leader mondial des plateformes de service client. Sa messagerie "
    "integree fonctionne sur le modele du ticket thread : chaque demande client ouvre un fil de "
    "discussion structure dans lequel les messages sont ordonnes chronologiquement et associes "
    "a des metadonnees riches (priorite, statut, assigne, tags). Le systeme supporte les "
    "conversations multicanal (email, chat en direct, reseaux sociaux) qui convergent toutes vers "
    "le meme ticket, garantissant une vue unifiee de l'echange quel que soit le canal d'entree. "
    "Zendesk propose egalement des macros (reponses predefinies), des declencheurs automatiques "
    "et des vues personnalisees qui permettent aux agents de traiter un volume eleve de "
    "conversations avec une efficacite optimale.",
    body_fr
))
story.append(Paragraph(
    "Ce qui rend la messagerie Zendesk particulierement pertinente pour notre analyse, c'est sa "
    "capacite a lier chaque conversation a un contexte metier precis. Un ticket n'est pas un "
    "simple message : c'est un conteneur qui regroupe la conversation, les pieces jointes, "
    "les notes internes entre agents, l'historique des changements de statut et les metriques "
    "de resolution. Cette approche structuree est directement transposable au cas de PRODESK, "
    "ou chaque dossier administratif pourrait devenir un fil de discussion centralisant "
    "toutes les communications relatees.",
    body_fr
))

story.append(add_heading('Freshdesk et Intercom : des approches complementaires', h3_style, 1))
story.append(Paragraph(
    "Freshdesk, de Freshworks, adopte une approche similaire a Zendesk mais avec une interface "
    "plus accessible et un cout moindre, ce qui en fait une option frequemment choisie par les "
    "PME et les startups. Sa messagerie integree offre les fonctionnalites essentielles : "
    "fil de discussion par ticket, notes internes invisibles pour le client, pieces jointes, "
    "et automatisation des regles d'assignation. La particularite de Freshdesk reside dans sa "
    "gamme de produits integres (Freshsales, Freshservice) qui permettent une communication "
    "transversale entre les equipes commerciales, de support et d'exploitation, un principe "
    "qui correspond au besoin multi-service de PRODESK.",
    body_fr
))
story.append(Paragraph(
    "Intercom, en revanche, se distingue par son orientation vers la messagerie en temps reel. "
    "Son widget de chat integre permet des echanges instantanes directement dans l'interface "
    "utilisateur, avec des fonctionnalites avancees comme les reponses intelligentes basees sur "
    "l'intelligence artificielle, les messages proactifs declenches par le comportement "
    "utilisateur, et les conversations transferees entre equipes. Intercom illustre un modele "
    "ou la messagerie n'est pas un outil complementaire mais le canal principal d'interaction, "
    "une philosophie qui merite d'etre consideree dans le contexte d'une plateforme de services "
    "ou la reactivite est un facteur differenciant cle.",
    body_fr
))

# Tableau comparatif helpdesks
helpdesk_headers = ['Critere', 'Zendesk', 'Freshdesk', 'Intercom']
helpdesk_rows = [
    ['Mode de communication', 'Ticket thread + multicanal', 'Ticket thread', 'Chat en temps reel'],
    ['Notes internes', 'Oui (invisibles client)', 'Oui (invisibles client)', 'Oui (equipe uniquement)'],
    ['Association dossier', 'Ticket lie a un objet', 'Ticket lie a un objet', 'Conversation liee au contact'],
    ['Automatisation', 'Declencheurs + macros', 'Regles d assignation', 'Messages proactifs + IA'],
    ['Piece jointe', 'Oui', 'Oui', 'Oui'],
    ['Notification push', 'Oui', 'Oui', 'Oui'],
    ['Cout (approx.)', '55-150 USD/agent/mois', '15-70 USD/agent/mois', '39-139 USD/agent/mois'],
]
cw_helpdesk = [CONTENT_W*0.22, CONTENT_W*0.26, CONTENT_W*0.26, CONTENT_W*0.26]
story.append(Spacer(1, 6))
story.append(make_table(helpdesk_headers, helpdesk_rows, cw_helpdesk))
story.append(Spacer(1, 12))

story.append(add_heading('Les ERP et systemes collaboratifs', h2_style, 1))
story.append(Paragraph(
    "Au-dela des plateformes de helpdesk, les ERP modernes et les systemes collaboratifs "
    "offrent un eclairage complementaire sur la maniere dont la messagerie peut etre integree "
    "a un systeme d'information complexe. Ces systemes se distinguent des helpdesks par leur "
    "approche transversale : la messagerie n'y est pas limitee au support client mais s'etend "
    "a l'ensemble des processus metier de l'organisation.",
    body_fr
))

story.append(add_heading('Odoo : messagerie integree au coeur de l ERP', h3_style, 1))
story.append(Paragraph(
    "Odoo represente peut-etre le cas d'etude le plus pertinent pour PRODESK Congo. Cet ERP "
    "modulaire, largement deploye en Afrique francophone, intègre une messagerie (Odoo Discuss) "
    "qui fonctionne comme un hub de communication central. Chaque module de l'ERP (ventes, "
    "comptabilite, RH, inventaire) peut generer des messages qui convergent vers la messagerie, "
    "et chaque message peut etre associe a un enregistrement specifique d'un module. Par exemple, "
    "un message lie a une commande client apparait a la fois dans la messagerie et dans la fiche "
    "de cette commande, creant un lien bidirectionnel entre communication et donnees metier.",
    body_fr
))
story.append(Paragraph(
    "La force du modele Odoo reside dans sa capacite a rendre la communication contextuelle. "
    "Les canaux de discussion peuvent etre publics (equipe), prives (entre deux personnes) "
    "ou lies a un document specifique. Les employees peuvent mentionner des collegues avec le "
    "symbole @, partager des pieces jointes, et recevoir des notifications qui les redirigent "
    "directement vers le contexte approprie. Pour PRODESK Congo, ce modele est particulierement "
    "adapté car il permettrait de creer des fils de discussion attaches a chaque dossier "
    "administratif, tout en conservant la flexibilite des canaux generaux pour les "
    "communications transversales entre services.",
    body_fr
))

story.append(add_heading('Slack et Microsoft Teams : la collaboration en equipe', h3_style, 1))
story.append(Paragraph(
    "Slack et Microsoft Teams ont revolutionne la communication d'entreprise en imposant le "
    "modele des canaux thématiques. Slack organise la communication autour de canaux publics "
    "ou prives, chacun dedie a un sujet, un projet ou une equipe. Les threads permettent de "
    "structurer les reponses au sein d'un canal, evitant ainsi la confusion des discussions "
    "paralleles. L'integration de bots et de webhooks permet de connecter Slack a des systemes "
    "externes, transformant chaque notification en un message actionnable dans le canal "
    "approprie.",
    body_fr
))
story.append(Paragraph(
    "Microsoft Teams, quant a lui, offre une integration profonde avec l'ecosysteme Microsoft 365. "
    "Sa messagerie est particulierement puissante dans les environnements corporatifs ou "
    "les outils Office sont deja deployes. Les onglets integres permettent d'inserer des "
    "applications tierces directement dans un canal, creant un espace de travail unifie. La "
    "particularite de Teams est sa gestion des equipes et des canaux hierarchiques, avec "
    "la possibilite de creer des sous-canaux pour des projets specifiques, un modele qui "
    "pourrait s'appliquer a l'organisation des services au sein de PRODESK.",
    body_fr
))

# Tableau comparatif ERP
erp_headers = ['Critere', 'Odoo Discuss', 'Slack', 'Microsoft Teams']
erp_rows = [
    ['Mode de communication', 'Canaux + messages lies aux documents', 'Canaux + threads', 'Equipes + canaux + onglets'],
    ['Integration metier', 'Natif (tous modules)', 'Via API / webhooks', 'Via connecteurs MS 365'],
    ['Canaux prives', 'Oui', 'Oui', 'Oui'],
    ['Mentions @', 'Oui', 'Oui', 'Oui'],
    ['Piece jointe', 'Oui', 'Oui', 'Oui'],
    ['Modele de deploiement', 'Cloud / auto-heberge', 'Cloud SaaS', 'Cloud SaaS'],
    ['Cout (approx.)', '25-40 EUR/utilisateur/mois', '7.25-12.50 USD/utilisateur/mois', '4-12.50 USD/utilisateur/mois'],
]
cw_erp = [CONTENT_W*0.22, CONTENT_W*0.26, CONTENT_W*0.26, CONTENT_W*0.26]
story.append(Spacer(1, 6))
story.append(make_table(erp_headers, erp_rows, cw_erp))
story.append(Spacer(1, 12))

story.append(add_heading('Les plateformes B2B de services', h2_style, 1))
story.append(Paragraph(
    "Un troisieme domaine d'analyse concerne les plateformes B2B specialisees dans la prestation "
    "de services, dont le modele operationnel se rapproche le plus de celui de CoursierB2B. "
    "Ces plateformes gerent des relations entre prestataires et clients, avec des workflows "
    "de commande, execution et livraison qui necessitent une communication structuree a chaque "
    "etape du processus.",
    body_fr
))

story.append(add_heading('Upwork et Fiverr : messagerie de prestation', h3_style, 1))
story.append(Paragraph(
    "Upwork, la plus grande plateforme de freelancing au monde, propose un systeme de "
    "messagerie lie a chaque contrat ou mission. La communication est structuree autour du "
    "projet : chaque echange est automatiquement associe au contrat correspondant, ce qui "
    "permet a la fois au client et au prestataire de retrouver l'historique complet de leurs "
    "discussions dans le contexte du projet. Upwork inclut egalement un systeme de milestones "
    "etapes qui permettent d'associer des paiements a des livrables specifiques, creant un "
    "lien direct entre communication, progression du travail et compensation financiere.",
    body_fr
))
story.append(Paragraph(
    "Fiverr adopte une approche plus legere avec une messagerie centrée sur la commande "
    "plutot que sur le projet long terme. Chaque commande ouvre un fil de discussion entre "
    "l'acheteur et le vendeur, et les echanges restent accessibles meme apres la livraison. "
    "Ce modele est pertinent pour PRODESK Congo car il demontre qu'une messagerie simple, "
    "liee a une transaction specifique, peut suffire a assurer un suivi de qualite sans "
    "la complexite d'un systeme de gestion de projet complet.",
    body_fr
))

story.append(add_heading('ServiceM8 et Jobber : outils de service sur le terrain', h3_style, 1))
story.append(Paragraph(
    "ServiceM8 et Jobber sont des plateformes concues pour les entreprises de services sur "
    "le terrain (plomberie, electricite, nettoyage, etc.). Leur approche de la messagerie est "
    "particulierement instructive pour PRODESK Congo car ces systemes gerent des agents qui "
    "se deplacent physiquement chez les clients, une dynamique similaire a celle des agents "
    "PRODESK qui se rendent dans les institutions administratives.",
    body_fr
))
story.append(Paragraph(
    "ServiceM8 integre une messagerie qui permet aux agents de terrain de communiquer avec "
    "le bureau et avec les clients directement depuis leur application mobile. Les messages "
    "sont lies aux jobs (interventions), et le systeme genere automatiquement des notifications "
    "lorsque le statut d'un job change. Jobber propose une fonctionnalite similaire avec en "
    "plus la possibilite d'envoyer des SMS aux clients directement depuis la plateforme, "
    "un atout majeur dans les contextes ou les clients ne sont pas toujours connectes a "
    "internet. Ces deux exemples montrent que la messagerie liee aux taches sur le terrain "
    "est devenue un standard industriel, et non un simple ajout optionnel.",
    body_fr
))

# Tableau comparatif B2B
b2b_headers = ['Critere', 'Upwork', 'Fiverr', 'ServiceM8']
b2b_rows = [
    ['Liaison messagerie-dossier', 'Liee au contrat', 'Liee a la commande', 'Liee au job'],
    ['Communication mobile', 'Application mobile', 'Application mobile', 'Application mobile native'],
    ['Pieces jointes', 'Oui', 'Oui', 'Oui (photos terrain)'],
    ['Notifications automatiques', 'Oui', 'Oui', 'Oui (changement statut)'],
    ['Historique accessible', 'Oui (post-livraison)', 'Oui (post-livraison)', 'Oui'],
    ['SMS integre', 'Non', 'Non', 'Oui'],
]
cw_b2b = [CONTENT_W*0.24, CONTENT_W*0.25, CONTENT_W*0.25, CONTENT_W*0.26]
story.append(Spacer(1, 6))
story.append(make_table(b2b_headers, b2b_rows, cw_b2b))
story.append(Spacer(1, 12))

# ═══════════════════════════════════════════════════════════════
# CHAPTER 4 : ANALYSE FONCTIONNELLE POUR PRODESK
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('Analyse fonctionnelle pour PRODESK Congo', h1_style, 0))

story.append(add_heading('Synthese des bonnes pratiques identifiees', h2_style, 1))
story.append(Paragraph(
    "L'analyse comparative des differentes categories de systemes permet de degager un ensemble "
    "de bonnes pratiques qui devraient guider la conception de la messagerie interne pour "
    "PRODESK Congo. Ces bonnes pratiques se repartissent en quatre axes principaux : "
    "la contextualisation, la tracabilite, l'accessibilite et l'automatisation.",
    body_fr
))
story.append(Paragraph(
    "La contextualisation est la pratique la plus recurrente dans les systemes etudies. "
    "Qu'il s'agisse de Zendesk (ticket), Odoo (document), Upwork (contrat) ou ServiceM8 (job), "
    "tous les systemes performants associent la messagerie a un objet metier specifique. "
    "Pour PRODESK, cela signifie que chaque fil de discussion devrait etre automatiquement "
    "lie au dossier administratif concerne, qu'il s'agisse d'une demande CNSS, d'une "
    "declaration DGI ou d'un enregistrement SFEC. Cette association permet de retrouver "
    "l'historique des communications dans le contexte du dossier, sans navigation "
    "supplementaire.",
    body_fr
))
story.append(Paragraph(
    "La tracabilite implique que chaque message, chaque piece jointe et chaque changement de "
    "statut est enregistre de maniere permanente et consultable par les personnes autorisees. "
    "Les notes internes, invisibles pour le client, sont une fonctionnalite presente dans "
    "quasiment tous les systemes analyses (Zendesk, Freshdesk, Odoo), ce qui confirme leur "
    "necessite dans un contexte ou les agents doivent pouvoir echanger des informations "
    "sensibles sans les exposer au client. L'accessibilite concerne la disponibilite de la "
    "messagerie sur tous les peripheriques (desktop et mobile), avec des notifications "
    "push pour les messages urgents. L'automatisation, enfin, couvre les reponses "
    "predefinies, les notifications de changement de statut et les rappels automatiques.",
    body_fr
))

# Tableau synthese
criteria_headers = ['Axe', 'Pratique', 'Systemes de reference']
criteria_rows = [
    ['Contextualisation', 'Fils de discussion lies au dossier', 'Zendesk, Odoo, Upwork, ServiceM8'],
    ['Tracabilite', 'Historique complet + notes internes', 'Zendesk, Freshdesk, Odoo'],
    ['Accessibilite', 'Mobile + notifications push', 'Intercom, ServiceM8, Fiverr'],
    ['Automatisation', 'Reponses predefinies + alertes', 'Zendesk, Freshdesk, Slack'],
    ['Securite', 'Notes internes + permissions', 'Zendesk, Odoo, MS Teams'],
    ['Simplicite', 'Interface minimaliste', 'Fiverr, Intercom'],
]
cw_criteria = [CONTENT_W*0.20, CONTENT_W*0.40, CONTENT_W*0.40]
story.append(Spacer(1, 6))
story.append(make_table(criteria_headers, criteria_rows, cw_criteria))
story.append(Spacer(1, 12))

story.append(add_heading('Architecture proposee pour la messagerie PRODESK', h2_style, 1))
story.append(Paragraph(
    "Sur la base des bonnes pratiques identifiees et des contraintes techniques de la plateforme "
    "CoursierB2B (Next.js, Prisma, PostgreSQL sur Neon), nous proposons une architecture de "
    "messagerie interne qui s'articule autour de trois composants principaux : un modele de "
    "donnees relationnel, une API temps reel et une interface utilisateur integree.",
    body_fr
))
story.append(Paragraph(
    "Le modele de donnees devrait comprendre au minimum trois tables : une table Conversation "
    "representant un fil de discussion (lie a un dossier optionnel, un service et un type de "
    "canal), une table Message contenant le contenu, l'auteur, l'horodatage et les eventuelles "
    "pieces jointes, et une table ConversationParticipant gerant les membres de chaque "
    "conversation avec leurs droits (lecture, ecriture, administration). Ce schema permet "
    "de couvrir tous les scenarios identifies : conversation client-agent liee a un dossier, "
    "canal prive entre agents, et canal de service pour les communications d'equipe.",
    body_fr
))
story.append(Paragraph(
    "Pour la partie temps reel, l'integration de WebSocket via Socket.io ou Pusher "
    "permettrait d'offrir une experience de messagerie instantanee sans necessiter de "
    "rechargement de page. Les notifications push pourraient etre implementees via "
    "le service Firebase Cloud Messaging pour les appareils mobiles et les notifications "
    "navigateur pour le mode desktop. L'interface utilisateur s'integrerait naturellement "
    "dans la navigation existante de CoursierB2B, avec un compteur de messages non lus dans "
    "la barre laterale et une vue de messagerie accessible depuis chaque dossier, "
    "permettant aux utilisateurs de communiquer sans quitter le contexte de leur travail.",
    body_fr
))

story.append(add_heading('Avantages quantifies pour PRODESK Congo', h2_style, 1))
story.append(Paragraph(
    "L'integration d'une messagerie interne dans PRODESK Congo presenterait des avantages "
    "tangibles a plusieurs niveaux. Sur le plan de l'efficacite operationnelle, la "
    "centralisation des communications reduirait le temps moyen de traitement des dossiers "
    "en eliminant les allers-retours entre differents canaux. Les industries du helpdesk "
    "reportent generalement une reduction de 20 a 35 % du temps de resolution lorsque "
    "la communication est integree au systeme de gestion des tickets, un chiffre "
    "raisonnablement transposable au contexte des services administratifs.",
    body_fr
))
story.append(Paragraph(
    "Sur le plan de la satisfaction client, la capacite a communiquer directement dans "
    "l'application, avec un historique consultable et des reponses rapides, ameliore "
    "significativement l'experience utilisateur. Les etudes sectorielles montrent que les "
    "plateformes B2B integrant une messagerie interne observent une augmentation de 15 a "
    "25 % du taux de retention client, car la transparence de la communication renforce "
    "la confiance dans le service rendu. Pour PRODESK Congo, ou la confiance est un "
    "facteur determinant dans le choix d'un prestataire administratif, cet avantage "
    "competitif pourrait s'averer decisif.",
    body_fr
))
story.append(Paragraph(
    "Enfin, sur le plan de la conformite et de la securite, une messagerie interne "
    "garantit que toutes les communications liees aux dossiers administratifs restent "
    "dans un environnement securise et controle. Les informations personnelles des clients "
    "(numeros d'identification, documents fiscaux, donnees sociales) ne transitent plus "
    "par des canaux externes non securises, ce qui constitue un atout considerable "
    "dans le cadre du respect de la reglementation sur la protection des donnees.",
    body_fr
))

# ═══════════════════════════════════════════════════════════════
# CHAPTER 5 : CONCLUSION ET RECOMMANDATION
# ═══════════════════════════════════════════════════════════════
story.append(add_heading('Conclusion et recommandation', h1_style, 0))

story.append(add_heading('Synthese de l etude', h2_style, 1))
story.append(Paragraph(
    "L'analyse approfondie menee tout au long de ce rapport demontre de maniere concluante "
    "que l'integration d'une messagerie interne au sein de PRODESK Congo n'est pas un "
    "luxe ni une fonctionnalite superflue, mais une necessite operationnelle. L'etude "
    "comparative de dix systemes de reference, couvrant trois categories distinctes (helpdesks, "
    "ERP collaboratifs, plateformes B2B de services), revele un consensus fort autour de "
    "certaines pratiques : la liaison de la messagerie aux objets metier, la tracabilite "
    "complete des echanges, la separation entre communications internes et externes, "
    "et l'accessibilite multi-canal.",
    body_fr
))
story.append(Paragraph(
    "Chaque systeme analyse, sans exception, intègre une forme de messagerie. Zendesk, "
    "Freshdesk et Intercom en font le coeur de leur proposition de valeur. Odoo, Slack et "
    "Microsoft Teams demontrent que la messagerie transversale est devenue un standard "
    "dans les systemes d'information d'entreprise. Upwork, Fiverr et ServiceM8 prouvent "
    "que meme les plateformes de services, dont le modele operationnel est le plus proche "
    "de celui de PRODESK, considerent la messagerie comme un composant indispensable "
    "de leur architecture. Le fait qu'aucun systeme comparable n'opere sans messagerie "
    "interne constitue un signal fort sur la necessite de cette fonctionnalite.",
    body_fr
))

story.append(add_heading('Recommandation', h2_style, 1))
story.append(Paragraph(
    "Nous recommandons l'implementation d'une messagerie interne structuree autour des "
    "principes suivants. Premierement, le modele dossier : chaque fil de discussion doit "
    "etre associé a un dossier administratif existant dans le systeme, garantissant ainsi la "
    "contextualisation de chaque echange. Deuxiemement, la dualite des canaux : les "
    "conversations doivent pouvoir etre soit liees a un dossier (client visible), soit "
    "internes entre agents et administrateurs (client invisible), permettant une "
    "communication transparente tout en preservant la confidentialite des discussions "
    "internes. Troisiemement, l'accessibilite mobile : la messagerie doit etre "
    "pleinement fonctionnelle sur mobile avec des notifications push, car les agents "
    "PRODESK sont frequemment en deplacement.",
    body_fr
))
story.append(Paragraph(
    "Quatriemement, l'approche progressive : nous suggerons de deployer la messagerie en "
    "deux phases. La premiere phase consisterait en un systeme de messagerie "
    "asynchrone (style ticket) lie aux dossiers, avec des notifications in-app et la "
    "possibilite d'envoyer des pieces jointes. La seconde phase ajouterait le temps reel "
    "via WebSocket, les notifications push mobiles, et les fonctionnalites avancees "
    "comme les reponses predefinies et les mentions. Cette approche permet de "
    "delivrer rapidement une valeur fonctionnelle tout en disposant d'une feuille de "
    "route pour les evolutions futures.",
    body_fr
))
story.append(Paragraph(
    "En conclusion, la messagerie interne est un investissement stratégique pour PRODESK "
    "Congo. Elle permettra de diferencier la plateforme sur un marche ou la reactivite et "
    "la transparence sont des criteres de choix decisifs pour les clients, d'ameliorer "
    "l'efficacite operationnelle des equipes, et de se conformer aux standards de "
    "securite et de tracabilite attendus par les institutions partenaires. Le cout de "
    "developpement est largement compense par les gains en productivite, en satisfaction "
    "client et en retention qu'une telle fonctionnalite engendrera.",
    body_fr
))

# ── Build ──
doc.multiBuild(story, onLaterPages=add_page_number, onFirstPage=add_page_number_skip_first)
print(f"Body PDF generated: {OUTPUT}")
