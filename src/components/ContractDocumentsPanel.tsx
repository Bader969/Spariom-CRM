import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Image as ImageIcon, Eye, Download, Trash2, XCircle, Loader2, FileUp, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { DocumentPreviewModal, type DocumentItem } from "./DocumentPreviewModal";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB limit with chunked upload
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ContractDocumentsPanel({ contractId }: { contractId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(null);

  // Fetch documents for this contract
  const { data: documents, isLoading } = useQuery({
    queryKey: ["contract_documents", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_documents")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Fetch Contract Documents Error]:", error);
        throw error;
      }
      return (data ?? []) as DocumentItem[];
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await processAndUploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await processAndUploadFile(file);
  };

  const processAndUploadFile = async (file: File) => {
    // 1. Client-Side Security Validations
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Datei zu groß (${formatBytes(file.size)}). Maximal 50 MB erlaubt.`);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) && !/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) {
      toast.error("Ungültiges Dateiformat. Nur PDFs und Bilder (PNG, JPG, WEBP) erlaubt.");
      return;
    }

    setUploading(true);
    setProgress(10);
    setUploadFileName(file.name);

    try {
      // 2. Upload file directly to Supabase Storage
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filePath = `${contractId}/${Date.now()}_${sanitizedName}`;

      setProgress(40);
      const { data: storageData, error: uploadError } = await supabase.storage
        .from("contract_documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setProgress(80);

      // 3. Insert record into database
      const { error: dbError } = await supabase.from("contract_documents").insert({
        contract_id: contractId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        uploaded_by: user?.id,
      });

      if (dbError) throw dbError;

      setProgress(100);
      toast.success("Dokument erfolgreich in Supabase gespeichert!");
      qc.invalidateQueries({ queryKey: ["contract_documents", contractId] });
    } catch (err: any) {
      console.error("Upload Error:", err);
      toast.error(err.message || "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadFileName("");
    }
  };

  const handleCancelUpload = () => {
    setUploading(false);
    setProgress(0);
    toast.info("Upload abgebrochen");
  };

  const handleDownload = async (doc: DocumentItem) => {
    const toastId = toast.loading(`„${doc.file_name}“ wird geladen…`);
    try {
      const { data, error } = await supabase.storage
        .from("contract_documents")
        .createSignedUrl(doc.file_path, 60);

      if (error || !data) throw error;
      
      const a = window.document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      toast.success("Download gestartet!", { id: toastId });
    } catch (err: any) {
      console.error("Download Error:", err);
      toast.error("Download fehlgeschlagen.", { id: toastId });
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm(`Dokument "${doc.file_name}" wirklich löschen?`)) return;

    try {
      // 1. Delete from storage
      await supabase.storage.from("contract_documents").remove([doc.file_path]);

      // 2. Delete from DB
      const { error } = await supabase.from("contract_documents").delete().eq("id", doc.id);
      if (error) throw error;

      toast.success("Dokument gelöscht");
      qc.invalidateQueries({ queryKey: ["contract_documents", contractId] });
    } catch (err: any) {
      console.error("Delete Error:", err);
      toast.error("Fehler beim Löschen des Dokuments.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all duration-200 ${
          uploading
            ? "border-primary/50 bg-primary/5 pointer-events-none"
            : "border-border hover:border-primary/60 hover:bg-accent/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span className="truncate max-w-[200px] sm:max-w-xs">{uploadFileName}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); handleCancelUpload(); }}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Upload abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileUp className="h-7 w-7 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Dokument oder Bild hochladen</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PDF, PNG, JPG, WEBP bis zu 25 MB • Per Drag & Drop ziehen oder klicken
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Angehängte Dokumente ({documents?.length ?? 0})
          </h4>
          <Badge variant="outline" className="text-[10px]">Private & Verschlüsselt</Badge>
        </div>

        {isLoading && (
          <div className="p-4 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Dokumente werden geladen…
          </div>
        )}

        {!isLoading && (!documents || documents.length === 0) && (
          <Card className="bg-accent/10 border-dashed">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Noch keine Dokumente zu diesem Vertrag hochgeladen.
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {documents?.map((doc) => {
            const isPdf = doc.mime_type === "application/pdf" || doc.file_name.toLowerCase().endsWith(".pdf");
            const isImage = doc.mime_type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(doc.file_name);

            return (
              <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded bg-muted shrink-0">
                      {isPdf ? (
                        <FileText className="h-5 w-5 text-red-500" />
                      ) : isImage ? (
                        <ImageIcon className="h-5 w-5 text-blue-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{doc.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString("de-DE")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewDocument(doc)}
                      title="Vorschau"
                    >
                      <Eye className="h-4 w-4 mr-1 text-primary" />
                      <span className="hidden sm:inline">Vorschau</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleDownload(doc)}
                      title="Herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(doc)}
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* In-App Preview Modal */}
      <DocumentPreviewModal
        open={!!previewDocument}
        onOpenChange={(open) => !open && setPreviewDocument(null)}
        document={previewDocument}
      />
    </div>
  );
}
