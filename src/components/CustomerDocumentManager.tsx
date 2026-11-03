import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  FileText, UploadCloud, Eye, Download, Trash2, Loader2, HardDrive, 
  CheckCircle2, FileCheck, FileImage, ShieldCheck, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

interface CustomerDocumentManagerProps {
  customerId: string;
  customerName?: string;
}

const CATEGORIES = [
  { id: "allgemein", label: "Allgemeines Dokument" },
  { id: "vertrag", label: "Vertragsunterlage" },
  { id: "antrag", label: "Antrag (GKV/PKV/Sach)" },
  { id: "kuendigung", label: "Kündigungsbestätigung" },
  { id: "ausweis", label: "Personalausweis / Dokumente" },
  { id: "beratungsprotokoll", label: "Beratungsprotokoll" },
];

export function CustomerDocumentManager({ customerId, customerName }: CustomerDocumentManagerProps) {
  const { user } = useAuth();

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("allgemein");
  const [dragActive, setDragActive] = useState(false);

  // Preview Dialog State
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch Documents for Customer
  const fetchDocs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("customer_documents" as any)
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error("Error loading customer documents:", err);
      toast.error("Fehler beim Laden der Dokumente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchDocs();
    }
  }, [customerId]);

  // Handle File Upload to Supabase Storage
  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Max 50 MB file size limit
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Die Datei „${file.name}“ ist ${(file.size / (1024 * 1024)).toFixed(1)} MB groß. Maximal 50 MB erlaubt.`);
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`„${file.name}“ wird hochgeladen…`);

    try {
      // 1. Upload to Supabase Storage
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filePath = `${customerId}/${Date.now()}_${sanitizedName}`;

      const { data: storageData, error: uploadError } = await supabase.storage
        .from("customer_documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Insert into database
      const { error: dbErr } = await supabase
        .from("customer_documents" as any)
        .insert({
          customer_id: customerId,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          hidrive_path: filePath,
          category: selectedCategory,
          created_by: user?.id || null,
        });

      if (dbErr) throw dbErr;

      toast.success("Dokument erfolgreich gespeichert!", { id: toastId });
      fetchDocs();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Fehler beim Hochladen.", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // Open Document Preview
  const handleOpenPreview = async (doc: any) => {
    setPreviewDoc(doc);
    setPreviewDataUrl(null);
    setLoadingPreview(true);

    try {
      const { data, error } = await supabase.storage
        .from("customer_documents")
        .createSignedUrl(doc.hidrive_path, 60);
      
      if (error || !data) throw error;
      setPreviewDataUrl(data.signedUrl);
    } catch (err: any) {
      console.error("Preview error:", err);
      toast.error("Fehler beim Laden der Vorschau.");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Download Document
  const handleDownload = async (doc: any) => {
    const toastId = toast.loading(`„${doc.file_name}“ wird geladen…`);
    try {
      const { data, error } = await supabase.storage
        .from("customer_documents")
        .createSignedUrl(doc.hidrive_path, 60);

      if (error || !data) throw error;
      
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download gestartet!", { id: toastId });
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error("Fehler beim Abrufen der Datei.", { id: toastId });
    }
  };

  // Delete Document
  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      const doc = documents.find(d => d.id === docId);
      if (doc && doc.hidrive_path) {
        await supabase.storage.from("customer_documents").remove([doc.hidrive_path]);
      }

      const { error } = await supabase.from("customer_documents" as any).delete().eq("id", docId);
      if (error) throw error;

      toast.success("Dokument gelöscht.");
      fetchDocs();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error("Fehler beim Löschen des Dokuments.");
    } finally {
      setDeletingId(null);
    }
  };

  // Format Bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <Card className="border-border/60 shadow-md overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" /> Dokumenten-Archiv
            </CardTitle>
            <CardDescription className="text-sm font-medium">
              Sichere Speicherung von Verträgen, Anträgen und Kündigungen.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-semibold gap-1.5 py-1 px-3">
            <ShieldCheck className="h-4 w-4" /> 100 % DSGVO-Konform
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Upload Zone & Category Picker */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="w-full sm:w-64 space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Dokument-Kategorie</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 relative cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-border/60 hover:border-primary/50 hover:bg-accent/30"
            }`}
          >
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              disabled={uploading}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
              </div>
              <div className="font-semibold text-foreground text-base">
                {uploading ? "Wird übertragen…" : "Datei hierhin ziehen oder klicken zum Auswählen"}
              </div>
              <p className="text-xs text-muted-foreground">
                Unterstützt PDF, JPG, PNG, Word, Excel bis max. 25 MB per Upload.
              </p>
            </div>
          </div>
        </div>

        {/* Documents Table / List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" /> Hochgeladene Dokumente ({documents.length})
            </h4>
          </div>

          {loading ? (
            <div className="p-8 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground">Dokumente werden geladen…</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center border rounded-xl border-dashed border-border/60 bg-muted/20">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-foreground">Noch keine Dokumente hinterlegt</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lade PDFs oder Verträge hoch, um sie sicher zu archivieren.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {documents.map((doc) => {
                const categoryObj = CATEGORIES.find((c) => c.id === doc.category);
                const isImage = doc.mime_type?.startsWith("image/");
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/20 transition-all duration-200 gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {isImage ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{doc.file_name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium">
                            {categoryObj?.label || doc.category}
                          </Badge>
                          <span>•</span>
                          <span>{formatBytes(doc.file_size)}</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString("de-DE")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 text-xs font-semibold"
                        onClick={() => handleOpenPreview(doc)}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" /> Vorschau
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 text-xs font-semibold"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === doc.id}
                        onClick={() => handleDelete(doc.id)}
                        title="Löschen"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> {previewDoc?.file_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Vorschau • {formatBytes(previewDoc?.file_size || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 bg-muted/40 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-border/50 mt-4">
            {loadingPreview ? (
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">Dokument wird abgerufen…</p>
              </div>
            ) : previewDataUrl ? (
              previewDoc?.mime_type?.startsWith("image/") ? (
                <img src={previewDataUrl} alt="" className="max-h-full max-w-full object-contain rounded-lg shadow-md" />
              ) : (
                <iframe src={previewDataUrl} className="w-full h-full rounded-lg border-0" title="Vorschau" />
              )
            ) : (
              <div className="text-center p-6 space-y-3 max-w-md">
                <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
                <div className="font-semibold text-foreground text-sm">Vorschau nicht verfügbar</div>
                <p className="text-xs text-muted-foreground">
                  Das Dokument konnte nicht geladen werden.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
