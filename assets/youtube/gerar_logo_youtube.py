"""Gera a foto de perfil do canal do YouTube (quadrada, arte centrada no círculo).
Redesenho vetorial da marca Morabilidade: skyline + wordmark + sublinhado + slogan."""
import sys
from PIL import Image, ImageDraw, ImageFont

FONTS = sys.argv[1]
OUT = sys.argv[2]

BG    = (88, 90, 79)      # oliva do logo original
GOLD  = (211, 202, 116)   # traço dourado
CREAM = (251, 251, 250)   # tipografia

# --- geometria em unidades do logo original (largura 1855) ---
STROKE = 37
# linha central da skyline (polilinha aberta), traçada da esquerda p/ direita
GROUND_Y = 360
SKY = [
    (8, GROUND_Y), (451, GROUND_Y),            # chão esquerdo
    (451, 257), (592, 257),                    # prédio baixo
    (592, 186),                                # sobe até o telhado inclinado
    (738, 152), (812, 182),                    # telhado
    (812, 23), (1063, 23),                     # prédio alto
    (1063, 176), (1298, 176),                  # prédio médio
    (1298, GROUND_Y), (1848, GROUND_Y),        # chão direito
]
# verticais que descem até o chão (bases dos prédios)
DROPS = [592, 812, 1063]
UNDER_Y, UNDER_W = 870, 31                     # sublinhado
TEXT_TOP, TEXT_H, TEXT_X0, TEXT_X1 = 426, 320, 11, 1836
TAG_TOP, TAG_H, TAG_W = 968, 62, 1560
ART_W, ART_H = 1855, 1040

def _wordmark_mask():
    """Máscara das letras originais: alpha do PNG ponderado pela cor creme (exclui o dourado)."""
    import numpy as np
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "site" / "public" / "logo-marca.png"
    a = np.array(Image.open(src).convert("RGBA")).astype(int)
    crop = a[TEXT_TOP:TEXT_TOP + TEXT_H + 1, TEXT_X0:TEXT_X1 + 1]
    cream = np.clip((crop[..., :3].min(-1) - 150) / 60, 0, 1)
    m = (crop[..., 3] / 255 * cream * 255).astype(np.uint8)
    # ampliar 2x antes de endurecer preserva a curva dos cantos
    return Image.fromarray(m).resize((m.shape[1] * 2, m.shape[0] * 2), Image.LANCZOS)
WORDMARK = _wordmark_mask()

def render(final_px, art_frac=0.80, ss=4, slogan=True, centrar_palavra=False):
    art_h = ART_H if slogan else 885
    C = final_px * ss                     # canvas supersampled
    k = C * art_frac / ART_W              # unidades -> px
    ox = (C - ART_W * k) / 2
    # centrar_palavra: o centro do wordmark cai no centro do círculo (onde ele é mais largo),
    # o que permite uma arte maior sem os cantos saírem do recorte circular
    ancora = (TEXT_TOP + TEXT_H / 2) if centrar_palavra else art_h / 2
    oy = C / 2 - ancora * k
    P = lambda x, y: (ox + x * k, oy + y * k)
    img = Image.new("RGB", (C, C), BG)
    d = ImageDraw.Draw(img)
    hs = STROKE * k / 2

    def seg(a, b):
        (x0, y0), (x1, y1) = P(*a), P(*b)
        if abs(y0 - y1) < 0.5 or abs(x0 - x1) < 0.5:       # eixo-alinhado: retângulo com junta reta
            d.rectangle([min(x0, x1) - hs, min(y0, y1) - hs, max(x0, x1) + hs, max(y0, y1) + hs], fill=GOLD)
        else:                                               # inclinado: linha + juntas redondas
            d.line([(x0, y0), (x1, y1)], fill=GOLD, width=int(round(STROKE * k)))
            for (x, y) in ((x0, y0), (x1, y1)):
                d.ellipse([x - hs, y - hs, x + hs, y + hs], fill=GOLD)

    for a, b in zip(SKY, SKY[1:]):
        seg(a, b)
    for x in DROPS:
        top = next(y for (px, y) in SKY if px == x)
        seg((x, top), (x, GROUND_Y))
    # sublinhado
    x0, y0 = P(8, UNDER_Y); x1, _ = P(1848, UNDER_Y); hu = UNDER_W * k / 2
    d.rectangle([x0, y0 - hu, x1, y0 + hu], fill=GOLD)

    # wordmark: letras ORIGINAIS da marca (site/public/logo-marca.png, 1855 px), reduzidas
    # e com borda endurecida — não é fonte substituta; é o mesmo desenho do banner
    target_w = int(round((TEXT_X1 - TEXT_X0) * k))
    m = WORDMARK.resize((target_w, int(round(WORDMARK.height * target_w / WORDMARK.width))), Image.LANCZOS)
    m = m.point(lambda v: 255 if v >= 128 else 0)          # borda cravada (o AA vem do downsample final)
    tx, ty = P(TEXT_X0, TEXT_TOP)
    img.paste(CREAM, (int(round(tx)), int(round(ty))), m)

    # slogan (Montserrat SemiBold, com tracking)
    if not slogan:
        return img.resize((final_px, final_px), Image.LANCZOS)
    tag = "SIMPLES, EFICIENTE E HUMANIZADA"
    f = ImageFont.truetype(f"{FONTS}/Montserrat.ttf", 200); f.set_variation_by_name("SemiBold")
    cap = f.getbbox("H")[3] - f.getbbox("H")[1]
    size = int(200 * TAG_H * k / cap)
    f = ImageFont.truetype(f"{FONTS}/Montserrat.ttf", size); f.set_variation_by_name("SemiBold")
    widths = [f.getlength(ch) for ch in tag]
    natural = sum(widths)
    track = (TAG_W * k - natural) / (len(tag) - 1)
    x = P(0, 0)[0] + (ART_W * k - TAG_W * k) / 2
    _, ty = P(0, TAG_TOP)
    top_off = f.getbbox("H")[1]
    for ch, w in zip(tag, widths):
        d.text((x, ty - top_off), ch, font=f, fill=CREAM)
        x += w + track

    return img.resize((final_px, final_px), Image.LANCZOS)

render(800).save(f"{OUT}/logo-youtube-completa-800.png", optimize=True)
render(2000, ss=2).save(f"{OUT}/logo-youtube-completa-2000.png", optimize=True)
# perfil: sem slogan e ocupando o máximo do círculo (cantos da arte ficam a ~12px da borda do círculo)
PERFIL = dict(art_frac=0.92, slogan=False, centrar_palavra=True)
render(800, **PERFIL).save(f"{OUT}/logo-youtube-perfil-800.png", optimize=True)
render(2000, ss=2, **PERFIL).save(f"{OUT}/logo-youtube-perfil-2000.png", optimize=True)

# prévia: como o YouTube mostra (círculo), com recompressão JPEG parecida com a da plataforma
import io
def jpeg(im, q=80):
    b = io.BytesIO(); im.save(b, "JPEG", quality=q); b.seek(0); return Image.open(b).convert("RGB")
prev = Image.new("RGB", (620, 470), (15, 15, 15)); dp = ImageDraw.Draw(prev)
for row, (label, im) in enumerate((("completa (atual)", render(800)), ("perfil (sem slogan)", render(800, **PERFIL)))):
    y0 = 40 + row * 220
    dp.text((20, y0 - 25), label, fill=(200, 200, 200))
    x = 20
    for size in (160, 88, 48):
        small = jpeg(im.resize((size, size), Image.LANCZOS))
        mask = Image.new("L", (size * 4, size * 4), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
        prev.paste(small, (x, y0 + (160 - size) // 2), mask.resize((size, size), Image.LANCZOS))
        x += size + 40
prev.save(f"{OUT}/preview-youtube.png")
print("ok")
