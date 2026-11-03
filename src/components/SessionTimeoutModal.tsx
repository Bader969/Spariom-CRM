import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

interface SessionTimeoutModalProps {
  open: boolean;
  countdown: number;
  onStayLoggedIn: () => void;
  onLogOut: () => void;
}

export function SessionTimeoutModal({
  open,
  countdown,
  onStayLoggedIn,
  onLogOut,
}: SessionTimeoutModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      // Prevent closing by clicking outside or pressing Escape
      if (!isOpen) onStayLoggedIn();
    }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Clock className="h-5 w-5" />
            Ihre Sitzung läuft bald ab
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base pt-2">
            Aus Sicherheitsgründen werden Sie bei Inaktivität automatisch abgemeldet.
            Ihre Sitzung endet in <strong className="text-foreground">{Math.ceil(countdown)} Sekunden</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex-col sm:flex-row-reverse sm:justify-start gap-2">
          <AlertDialogAction onClick={onStayLoggedIn} className="w-full sm:w-auto">
            Eingeloggt bleiben
          </AlertDialogAction>
          <AlertDialogCancel onClick={onLogOut} className="w-full sm:w-auto">
            Abmelden
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
