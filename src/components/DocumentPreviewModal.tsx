import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Image as ImageIcon, ExternalLink, Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { toast } from "sonner";



export interface DocumentItem {
  id: string;
  contract_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentItem | null;
}

export function DocumentPreviewModal({ open, onOpenChange, document }: DocumentPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!open || !document) {
      setSignedUrl(null);
      setZoom(1);
      setRotation(0);
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function fetchSignedUrl() {
      try {
        const { data, error } = await supabase.storage
          .from("contract_documents")
          .createSignedUrl(document!.file_path, 3600);
          
        if (error) throw error;
        if (data?.signedUrl && isMounted) {
          setSignedUrl(data.signedUrl);
        }
      } catch (err: any) {
        console.error("Preview Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSignedUrl();
    return () => { isMounted = false; };
  }, [open, document]);

  if (!document) return null;

  const isPdf = document.mime_type === "application/pdf" || document.file_name.toLowerCase().endsWith(".pdf");
  const isImage = document.mime_type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(document.file_name);

  const handleDownload = () => {
    if (!signedUrl) return;
    const a = window.document.createElement("a");
    a.href = signedUrl;
    a.download = document.file_name;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40 pr-6">
          <div className="flex items-center gap-2.5 truncate">
            {isPdf ? (
              <FileText className="h-5 w-5 text-red-500 shrink-0" />
            ) : isImage ? (
              <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
            ) : (
              <FileText className="h-5 w-5 text-primary shrink-0" />
            )}
            <DialogTitle className="text-base font-semibold truncate">
              {document.file_name}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {signedUrl && (
              <>
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download
                </Button>
                <a href={signedUrl} target="_blank" rel="noreferrer">
                  <Button size="icon" variant="ghost" title="In neuem Tab öffnen">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-accent/20 rounded-lg p-2 sm:p-4 flex items-center justify-center overflow-auto relative mt-3">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Sichere Vorschau wird geladen…</p>
            </div>
          )}

          {!loading && signedUrl && isPdf && (
            <iframe
              src={`${signedUrl}#toolbar=1&navpanes=0`}
              title={document.file_name}
              className="w-full h-[70vh] rounded border border-border/50 bg-background"
            />
          )}

          {!loading && signedUrl && isImage && (
            <div className="flex flex-col items-center justify-center w-full h-full relative">
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm p-1 rounded-md border shadow-sm z-10">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRotation((r) => (r + 90) % 360)}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="overflow-auto max-h-[70vh] flex items-center justify-center p-4">
                <img
                  src={signedUrl}
                  alt={document.file_name}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: "transform 0.2s ease-out",
                  }}
                  className="max-h-[65vh] max-w-full object-contain rounded-md shadow-md"
                />
              </div>
            </div>
          )}

          {!loading && signedUrl && !isPdf && !isImage && (
            <div className="text-center p-8 space-y-3">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">Keine direkte In-App Vorschau für diesen Dateityp verfügbar.</p>
              <Button onClick={handleDownload} size="sm">
                <Download className="h-4 w-4 mr-2" /> Datei herunterladen
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
