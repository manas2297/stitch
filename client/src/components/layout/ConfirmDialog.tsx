import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import useAppStore from '../../store/useAppStore';

/** Global confirm prompt driven by `confirm()` in the store helpers. */
export default function ConfirmDialog() {
  const { confirmModal, resolveConfirm } = useAppStore();

  return (
    <AlertDialog open={!!confirmModal} onOpenChange={(open) => !open && resolveConfirm(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmModal?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmModal?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolveConfirm(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => resolveConfirm(true)}>
            Yes, Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
