import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Trash2, CheckCircle, Calendar, Hash, Building2, Zap, ArrowRightLeft } from "lucide-react";
import {
  contractTypeIcon,
  contractTypeLabel,
  contractStatusMeta,
  formatDate,
} from "@/lib/crm-types";
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

interface ContractDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any | null;
  partnerContract: any | null;
  reason?: string;
  onDeleteContract: (contractId: string) => Promise<void>;
}

export function ContractDuplicateDialog({
  open,
  onOpenChange,
  contract,
  partnerContract,
  reason,
  onDeleteContract,
}: ContractDuplicateDialogProps) {
  const [contractToDelete, setContractToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!contract || !partnerContract) return null;

  const handleDeleteConfirmed = async () => {
    if (!contractToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteContract(contractToDelete.id);
      setContractToDelete(null);
      onOpenChange(false);
    } catch (e) {
      console.error("Error deleting contract from duplicate dialog:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderContractCard = (c: any, isOriginal: boolean) => {
    const meta = contractStatusMeta(c.status);
    const zaehler = c.details?.zaehlernummer || c.details?.zaehler_nummer || "";
    const tarif = c.details?.tarif || c.details?.tarif_name || "";

    return (
      <Card className={`border-2 flex-1 flex flex-col justify-between ${isOriginal ? "border-primary/40 bg-primary/5" : "border-amber-500/40 bg-amber-500/5"}`}>
        <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isOriginal ? "Vertrag 1" : "Vertrag 2 (Dublette)"}
              </span>
              <Badge className={`${meta.color} font-normal text-xs`}>
                {meta.label}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-base">
                <span>{contractTypeIcon(c.type)}</span>
                <span>{contractTypeLabel(c.type)}</span>
              </div>
              <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{c.provider || "Kein Anbieter"}</span>
              </div>
              {tarif && (
                <div className="text-xs text-muted-foreground truncate" title={tarif}>
                  Tarif: <span className="font-medium text-foreground">{tarif}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border/50 pt-2 space-y-1.5 text-xs text-muted-foreground">
              {c.referenz_id && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Ref-ID:
                  </span>
                  <span className="font-mono font-medium text-foreground">{c.referenz_id}</span>
                </div>
              )}
              {zaehler && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" /> Zählernummer:
                  </span>
                  <span className="font-mono font-medium text-foreground">{zaehler}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Laufzeit:
                </span>
                <span>
                  {c.start_date ? formatDate(c.start_date) : "—"} bis {c.end_date ? formatDate(c.end_date) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Erfasst am:</span>
                <span>{formatDate(c.created_at)}</span>
              </div>
              {c.monthly_amount && (
                <div className="flex items-center justify-between">
                  <span>Monatlich:</span>
                  <span className="font-medium text-foreground">{c.monthly_amount} €</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border/50">
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={() => setContractToDelete(c)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Diesen Vertrag löschen
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Mögliche Vertrags-Dublette erkannt
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Diese beiden Verträge weisen identische oder stark überschneidende Merkmale auf.
              Prüfen Sie beide Verträge und bereinigen Sie die Dublette.
            </DialogDescription>
          </DialogHeader>

          {reason && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <strong>Grund für Konflikt:</strong> {reason}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
            {renderContractCard(contract, true)}
            {renderContractCard(partnerContract, false)}
          </div>

          <DialogFooter className="gap-2 sm:justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Tipp: Wählen Sie den Vertrag aus, der fälschlich oder doppelt angelegt wurde.
            </span>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert for deleting one of the duplicates */}
      <AlertDialog open={!!contractToDelete} onOpenChange={(val) => !val && setContractToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Vertrag unwiderruflich löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diesen Vertrag ({contractToDelete?.provider || "Vertrag"} – Ref: {contractToDelete?.referenz_id || contractToDelete?.id?.slice(0, 8)}) wirklich endgültig löschen?
              <br /><br />
              Alle verknüpften Unterlagen und Daten zu diesem Vertrag werden dabei entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDeleteConfirmed}
              disabled={isDeleting}
            >
              {isDeleting ? "Wird gelöscht…" : "Ja, Vertrag endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
