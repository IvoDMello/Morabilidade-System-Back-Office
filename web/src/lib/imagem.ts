// Rotaciona um arquivo de imagem usando um canvas. Sentido horário, em graus
// (90/180/270). Devolve um novo File JPEG mantendo o nome original (extensão
// .jpg). Usado para girar fotos antes do upload no cadastro de imóveis.

const ROTACAO_MIME = "image/jpeg";
const ROTACAO_QUALIDADE = 0.92;

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem para rotação."));
    img.src = url;
  });
}

export async function rotacionarArquivoImagem(file: File, graus: number): Promise<File> {
  const normalized = ((graus % 360) + 360) % 360;
  if (normalized === 0) return file;
  if (![90, 180, 270].includes(normalized)) {
    throw new Error("Rotação inválida, use 90, 180 ou 270 graus.");
  }

  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await carregarImagem(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  const canvas = document.createElement("canvas");
  const radianos = (normalized * Math.PI) / 180;
  const trocaDimensoes = normalized === 90 || normalized === 270;
  canvas.width = trocaDimensoes ? img.naturalHeight : img.naturalWidth;
  canvas.height = trocaDimensoes ? img.naturalWidth : img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radianos);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem rotacionada."))),
      ROTACAO_MIME,
      ROTACAO_QUALIDADE
    );
  });

  const nomeOriginalSemExt = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${nomeOriginalSemExt}.jpg`, {
    type: ROTACAO_MIME,
    lastModified: Date.now(),
  });
}
