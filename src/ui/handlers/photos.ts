import { getState, setState } from "../state";
import { deletePhoto, loadPhoto, savePhoto } from "@/data/photos";
import { compressImage, PHOTO_MAX_CHARS } from "../image";
import { withPhotoFlags, type PhotoCopy } from "@/domain/photo-copy";
import { replacePlanDays } from "@/domain/plan-edit";
import { currentClient, mutateExercise, persist } from "./target";
import type { Exercise } from "@/data/schema";

/** Leituras já disparadas, para a render não pedir a mesma foto duas vezes. */
const requested = new Set<string>();

function remember(exId: string, src: string | null): void {
  const next = new Map(getState().photos);
  next.set(exId, src);
  setState({ photos: next });
}

async function fetchPhoto(clientId: string, exId: string): Promise<void> {
  try {
    remember(exId, await loadPhoto(clientId, exId));
  } catch {
    // sem rede, por exemplo: a próxima render tenta de novo
    requested.delete(exId);
  }
}

/**
 * Some com a foto de um exercício que está sendo removido. Só o treinador
 * remove exercício, e só ele pode apagar foto.
 */
export function forgetPhoto(clientId: string, ex: Exercise): void {
  if (ex.hasPhoto) deletePhoto(clientId, ex.id).catch(() => {});
}

export const photos = {
  /**
   * A foto a mostrar: o texto da imagem, null quando não há, ou undefined
   * enquanto carrega. Dispara a leitura na primeira vez; a resposta chega pelo
   * estado e redesenha a tela.
   */
  photoOf: (ex: Exercise): string | null | undefined => {
    if (ex.photoUrl) return ex.photoUrl;
    if (!ex.hasPhoto) return null;
    const known = getState().photos.get(ex.id);
    if (known !== undefined) return known;
    const c = currentClient();
    if (c && !requested.has(ex.id)) {
      requested.add(ex.id);
      void fetchPhoto(c.id, ex.id);
    }
    return undefined;
  },

  onAddPhoto: async (exId: string, file: File) => {
    const c = currentClient();
    if (!c) return;
    let dataUrl: string;
    try {
      dataUrl = await compressImage(file);
    } catch {
      setState({ error: "Não foi possível ler essa imagem." });
      return;
    }
    if (dataUrl.length > PHOTO_MAX_CHARS) {
      setState({ error: "Foto muito grande ou detalhada. Tente outra." });
      return;
    }
    remember(exId, dataUrl);
    // sem await: offline a promessa só resolve quando sincronizar
    savePhoto(c.id, exId, dataUrl).catch(() => setState({ error: "Não foi possível salvar a foto." }));
    mutateExercise(exId, (e) => ({ ...e, hasPhoto: true }));
  },

  onRemovePhoto: (exId: string) => {
    const c = currentClient();
    if (!c || !confirm("Remover essa foto?")) return;
    remember(exId, null);
    deletePhoto(c.id, exId).catch(() => {});
    mutateExercise(exId, ({ hasPhoto: _flag, photoUrl: _inline, ...rest }) => rest);
  },

  onViewPhoto: (src: string) => setState({ photoViewer: src }),
  onClosePhoto: () => setState({ photoViewer: null }),
};

/**
 * Copia as fotos para os exercícios de um plano recém-criado e marca `hasPhoto`
 * nos que deram certo. Roda no aparelho do treinador, o único que pode escrever
 * fotos. Uma foto que falha deixa aquele exercício sem foto, e não quebrado.
 */
export async function copyPlanPhotos(clientId: string, planId: string, copies: PhotoCopy[]): Promise<void> {
  const copied = new Set<string>();
  for (const cp of copies) {
    try {
      const src = cp.inline ?? (await loadPhoto(clientId, cp.from));
      if (!src) continue;
      savePhoto(clientId, cp.to, src).catch(() =>
        setState({ error: "Não foi possível copiar uma foto para o plano." }),
      );
      remember(cp.to, src);
      copied.add(cp.to);
    } catch {
      // foto de origem ilegível: o exercício do plano segue sem foto
    }
  }
  if (!copied.size) return;

  // relê o aluno agora: o plano pode ter sido editado enquanto as fotos copiavam
  const client = getState().clients.find((c) => c.id === clientId);
  const plans = client?.weekPlans ?? [];
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return;
  persist(clientId, { weekPlans: replacePlanDays(plans, planId, withPhotoFlags(plan.days, copied)) });
}
