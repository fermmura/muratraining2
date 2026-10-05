import { getState, setState } from "../state";
import { parseWorkoutText } from "@/domain/workout-import";
import { currentClient, persist } from "./target";
import { resetScreen } from "./trainer";

// mensagens do 1.0
const EMPTY = "Cole o texto do treino antes de importar.";
const NO_DAY = 'Não encontrei nenhum dia da semana nesse texto (ex.: "Segunda-feira"). Confira o formato.';

/** `importer`, e não `import`: a palavra é reservada. */
export const importer = {
  onOpen: () => {
    // só nos treinos atuais, como no 1.0: num plano de semana futura o botão nem aparece
    if (getState().editTarget.kind !== "current") return;
    setState({ screen: "import", activeDayId: null, importText: "", importPreview: null, importError: null });
  },

  onRead: (text: string) => {
    if (!text.trim()) {
      setState({ importText: text, importPreview: null, importError: EMPTY });
      return;
    }
    const days = parseWorkoutText(text);
    setState({
      importText: text,
      importPreview: days.length ? days : null,
      importError: days.length ? null : NO_DAY,
    });
  },

  /** Volta da prévia para a caixa, com o texto que estava lá. */
  onEdit: () => setState({ importPreview: null }),

  /** Acrescenta os dias lidos ao fim dos treinos do aluno, sem tocar nos que já existem. */
  onConfirm: () => {
    const c = currentClient();
    const days = getState().importPreview;
    if (!c || !days) return;
    persist(c.id, { days: [...(c.days ?? []), ...days] });
    setState({ importText: "", importPreview: null });
    resetScreen();
  },

  onClose: () => resetScreen(),
};
