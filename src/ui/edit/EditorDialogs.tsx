import { useEditor } from './editorStore';
import { DeleteManyDialog, DeletePersonDialog, DeleteUnionDialog } from '../dialogs/DeleteDialogs';
import { MergeDialog } from '../dialogs/MergeDialog';
import { WarningsDialog } from '../dialogs/WarningsDialog';
import { useAppStore } from '@/store/store';

/** Modal dialogs opened through the editor store; mounted once in the shell. */
export function EditorDialogs({ onDeletedMany }: { onDeletedMany?: () => void }) {
  const state = useEditor((s) => s.state);
  const project = useAppStore((s) => s.project);
  if (!project) return null;
  switch (state.kind) {
    case 'deletePerson':
      return <DeletePersonDialog id={state.id} />;
    case 'deleteUnion':
      return <DeleteUnionDialog id={state.id} />;
    case 'deleteMany':
      return <DeleteManyDialog ids={state.ids} onDone={() => onDeletedMany?.()} />;
    case 'merge':
      return <MergeDialog aId={state.aId} bId={state.bId} />;
    case 'warnings':
      return <WarningsDialog />;
    default:
      return null;
  }
}
