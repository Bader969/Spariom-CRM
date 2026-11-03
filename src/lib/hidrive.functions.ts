import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// Strato HiDrive Config (Supports WebDAV, Custom URLs, and Strato Upload-Freigabe Links!)
const HIDRIVE_URL = (process.env.HIDRIVE_WEBDAV_URL || process.env.HIDRIVE_URL || "https://webdav.hidrive.strato.com").replace(/\/$/, "");
const HIDRIVE_USER = process.env.HIDRIVE_USERNAME || "";
const HIDRIVE_PASS = process.env.HIDRIVE_PASSWORD || process.env.HIDRIVE_SHARE_PASSWORD || "";

// Helper for WebDAV Root Path mapping (Maps to "Privat" or "Gemeinsam" in Strato Web GUI)
function getHiDriveRootPath(): string {
  if (HIDRIVE_USER) {
    return `/users/${HIDRIVE_USER.toLowerCase()}`;
  }
  return "/public";
}

// Helper for WebDAV Basic Auth (if username exists)
function getHiDriveAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (HIDRIVE_USER && HIDRIVE_PASS) {
    const token = Buffer.from(`${HIDRIVE_USER}:${HIDRIVE_PASS}`).toString("base64");
    headers["Authorization"] = `Basic ${token}`;
  }
  if (HIDRIVE_PASS) {
    headers["X-HiDrive-Password"] = HIDRIVE_PASS;
  }
  return headers;
}

// Ensure Directory helper (creates missing folders in HiDrive WebDAV)
async function ensureHiDriveDir(dirPath: string): Promise<void> {
  if (!HIDRIVE_USER) return; // Skip directory creation for public upload share links
  const parts = dirPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += "/" + part;
    const url = `${HIDRIVE_URL}${current}`;
    try {
      await fetch(url, {
        method: "MKCOL",
        headers: getHiDriveAuthHeaders(),
      });
    } catch {
      // Ignore
    }
  }
}

// Multi-Strategy Master Upload Engine: Tries WebDAV PUT, Share Link POST, and Direct Form POST
async function uploadToHiDriveStorage(fullPath: string, buffer: Buffer, fileName: string, mimeType: string) {
  if (!HIDRIVE_URL) {
    throw new Error("HiDrive URL (HIDRIVE_WEBDAV_URL) ist in Vercel noch nicht konfiguriert.");
  }

  const errors: string[] = [];

  // Attempt 1: Standard WebDAV PUT to full file path
  try {
    const targetUrl = `${HIDRIVE_URL}${fullPath}`;
    const res = await fetch(targetUrl, {
      method: "PUT",
      headers: {
        ...getHiDriveAuthHeaders(),
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString(),
      },
      body: new Uint8Array(buffer),
    });

    if (res.ok || res.status === 201 || res.status === 204) {
      if ((res.headers.get("content-type") || "").includes("text/html")) {
        throw new Error("WebDAV PUT lieferte eine HTML-Seite zurück (Upload-Freigabe Link ist kein API-Endpunkt)");
      }
      return res;
    }
    const txt = await res.text();
    errors.push(`WebDAV PUT (${res.status}): ${txt.replace(/<[^>]*>/g, "").slice(0, 100).trim()}`);
  } catch (err: any) {
    errors.push(`WebDAV PUT Exception: ${err.message}`);
  }

  // Attempt 2: Strato Upload-Freigabe Link POST (multipart/form-data)
  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append("file", blob, fileName);
    if (HIDRIVE_PASS) {
      formData.append("password", HIDRIVE_PASS);
      formData.append("pass", HIDRIVE_PASS);
    }

    const postHeaders: Record<string, string> = {};
    if (HIDRIVE_PASS) {
      postHeaders["X-HiDrive-Password"] = HIDRIVE_PASS;
    }
    if (HIDRIVE_USER && HIDRIVE_PASS) {
      postHeaders["Authorization"] = `Basic ${Buffer.from(`${HIDRIVE_USER}:${HIDRIVE_PASS}`).toString("base64")}`;
    }

    const res = await fetch(HIDRIVE_URL, {
      method: "POST",
      headers: postHeaders,
      body: formData,
    });

    if (res.ok || res.status === 201 || res.status === 204) {
      if ((res.headers.get("content-type") || "").includes("text/html")) {
        throw new Error("Share POST lieferte eine HTML-Seite zurück. Ein Upload-Freigabe Link kann nicht ohne Web-Scraping automatisiert werden.");
      }
      return res;
    }
    const txt = await res.text();
    errors.push(`Share POST (${res.status}): ${txt.replace(/<[^>]*>/g, "").slice(0, 100).trim()}`);
  } catch (err: any) {
    errors.push(`Share POST Exception: ${err.message}`);
  }

  // Attempt 3: Direct POST to target file URL
  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append("file", blob, fileName);
    if (HIDRIVE_PASS) {
      formData.append("password", HIDRIVE_PASS);
    }

    const targetUrl = `${HIDRIVE_URL}/${encodeURIComponent(fileName)}`;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: getHiDriveAuthHeaders(),
      body: formData,
    });

    if (res.ok || res.status === 201 || res.status === 204) {
      if ((res.headers.get("content-type") || "").includes("text/html")) {
        throw new Error("File POST lieferte eine HTML-Seite zurück.");
      }
      return res;
    }
    const txt = await res.text();
    errors.push(`File POST (${res.status}): ${txt.replace(/<[^>]*>/g, "").slice(0, 100).trim()}`);
  } catch (err: any) {
    errors.push(`File POST Exception: ${err.message}`);
  }

  throw new Error(`Strato Upload fehlgeschlagen. Details: [${errors.join(" | ")}] (Ziel-URL: ${HIDRIVE_URL})`);
}

// 1. Direct Single-Shot Upload
export const uploadDirectToHiDrive = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      fileName: z.string().min(1),
      fileBase64: z.string().min(1),
      mimeType: z.string().default("application/octet-stream"),
      fileSize: z.number(),
      type: z.enum(["customer", "contract"]),
      meta: z.record(z.string(), z.any()),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { fileName, fileBase64, mimeType, fileSize, type } = data;
    const meta = data.meta as Record<string, any>;

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const rootPath = getHiDriveRootPath();

    if (type === "customer") {
      const sanitizedCustomerName = ((meta.customerName as string) || (meta.customerId as string).slice(0, 8)).replace(/[^a-zA-Z0-9._-]/g, "_");
      const dirPath = `${rootPath}/Blitzvox_CRM/Kunden/${sanitizedCustomerName}/Dokumente`;
      const fullHiDrivePath = `${dirPath}/${Date.now()}_${sanitizedFileName}`;

      await ensureHiDriveDir(dirPath);
      await uploadToHiDriveStorage(fullHiDrivePath, buffer, fileName, mimeType);

      const { data: dbDoc, error: dbErr } = await supabase
        .from("customer_documents" as any)
        .insert({
          customer_id: meta.customerId,
          file_name: fileName,
          file_size: fileSize,
          mime_type: mimeType,
          hidrive_path: fullHiDrivePath,
          category: meta.category || "allgemein",
          created_by: meta.createdBy || null,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;
      return { success: true, document: dbDoc };
    } else {
      // Contract upload
      const dirPath = `${rootPath}/Blitzvox_CRM/Vertraege/${meta.contractId}`;
      const fullHiDrivePath = `${dirPath}/${Date.now()}_${sanitizedFileName}`;

      await ensureHiDriveDir(dirPath);
      await uploadToHiDriveStorage(fullHiDrivePath, buffer, fileName, mimeType);

      const { data: dbDoc, error: dbErr } = await supabase
        .from("contract_documents")
        .insert({
          contract_id: meta.contractId,
          file_name: fileName,
          file_path: fullHiDrivePath,
          file_size: fileSize,
          mime_type: mimeType,
          uploaded_by: meta.uploadedBy || null,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;
      return { success: true, document: dbDoc };
    }
  });

// 2. Chunked Upload
export const uploadHiDriveChunk = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      uploadId: z.string().min(1),
      chunkIndex: z.number(),
      totalChunks: z.number(),
      chunkBase64: z.string().min(1),
      isLastChunk: z.boolean(),
      type: z.enum(["customer", "contract"]),
      meta: z.record(z.string(), z.any()),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { uploadId, chunkIndex, totalChunks, chunkBase64, isLastChunk, type } = data;
    const meta = data.meta as Record<string, any>;

    if (isLastChunk || chunkIndex === totalChunks - 1) {
      const fullBuffer = Buffer.from(chunkBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
      const sanitizedFileName = (meta.fileName as string).replace(/[^a-zA-Z0-9._-]/g, "_");

      const rootPath = getHiDriveRootPath();
      let finalPath = "";
      if (type === "customer") {
        const sanitizedCustomerName = ((meta.customerName as string) || (meta.customerId as string).slice(0, 8)).replace(/[^a-zA-Z0-9._-]/g, "_");
        const dirPath = `${rootPath}/Blitzvox_CRM/Kunden/${sanitizedCustomerName}/Dokumente`;
        finalPath = `${dirPath}/${Date.now()}_${sanitizedFileName}`;

        await ensureHiDriveDir(dirPath);
        await uploadToHiDriveStorage(finalPath, fullBuffer, meta.fileName, meta.mimeType || "application/pdf");

        const { data: dbDoc, error: dbErr } = await supabase
          .from("customer_documents" as any)
          .insert({
            customer_id: meta.customerId,
            file_name: meta.fileName,
            file_size: meta.fileSize,
            mime_type: meta.mimeType || "application/pdf",
            hidrive_path: finalPath,
            category: meta.category || "allgemein",
            created_by: meta.createdBy || null,
          })
          .select()
          .single();

        if (dbErr) throw dbErr;
        return { success: true, document: dbDoc };
      } else {
        const dirPath = `${rootPath}/Blitzvox_CRM/Vertraege/${meta.contractId}`;
        finalPath = `${dirPath}/${Date.now()}_${sanitizedFileName}`;

        await ensureHiDriveDir(dirPath);
        await uploadToHiDriveStorage(finalPath, fullBuffer, meta.fileName, meta.mimeType || "application/octet-stream");

        const { data: dbDoc, error: dbErr } = await supabase
          .from("contract_documents")
          .insert({
            contract_id: meta.contractId,
            file_name: meta.fileName,
            file_path: finalPath,
            file_size: meta.fileSize,
            mime_type: meta.mimeType || "application/octet-stream",
            uploaded_by: meta.uploadedBy || null,
          })
          .select()
          .single();

        if (dbErr) throw dbErr;
        return { success: true, document: dbDoc };
      }
    }

    return { success: true, pending: true };
  });

// Smart Client Uploader
export async function uploadFileInChunks(
  file: File,
  type: "customer" | "contract",
  meta: Record<string, any>,
  onProgress?: (percent: number) => void
) {
  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (onProgress) onProgress(50);
  const res = await uploadDirectToHiDrive({
    data: {
      fileName: file.name,
      fileBase64,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      type,
      meta,
    },
  });
  if (onProgress) onProgress(100);
  return res;
}

// 3. Get Customer Document (Base64) from Strato HiDrive
export const getHiDriveDocumentBase64 = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { documentId } = data;

    const { data: doc, error: dbErr } = await supabase
      .from("customer_documents" as any)
      .select("*")
      .eq("id", documentId)
      .single();

    if (dbErr || !doc) {
      throw new Error("Dokument nicht in der Datenbank gefunden.");
    }

    if ((doc as any).hidrive_path) {
      const fileUrl = `${HIDRIVE_URL}${(doc as any).hidrive_path}`;
      const res = await fetch(fileUrl, {
        method: "GET",
        headers: getHiDriveAuthHeaders(),
      });

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:${(doc as any).mime_type || "application/pdf"};base64,${base64}`;
        return { success: true, document: doc, dataUrl };
      }
    }

    return { 
      success: true, 
      document: doc, 
      dataUrl: null,
      message: "Dokument konnte von HiDrive abgerufen werden." 
    };
  });

// 4. Delete Customer Document from Strato HiDrive and Supabase
export const deleteCustomerDocument = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { documentId } = data;

    const { data: doc } = await supabase
      .from("customer_documents" as any)
      .select("*")
      .eq("id", documentId)
      .single();

    if (doc && (doc as any).hidrive_path) {
      try {
        const fileUrl = `${HIDRIVE_URL}${(doc as any).hidrive_path}`;
        await fetch(fileUrl, {
          method: "DELETE",
          headers: getHiDriveAuthHeaders(),
        });
      } catch (err) {
        console.error("[HiDrive Delete File Error]:", err);
      }
    }

    const { error: dbErr } = await supabase
      .from("customer_documents" as any)
      .delete()
      .eq("id", documentId);

    if (dbErr) throw dbErr;

    return { success: true };
  });

// 5. Get Contract Document Base64 from Strato HiDrive
export const getContractDocumentHiDriveBase64 = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { documentId } = data;

    const { data: doc, error: dbErr } = await supabase
      .from("contract_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (dbErr || !doc) throw new Error("Dokument nicht gefunden.");

    if (doc.file_path) {
      const rootPath = getHiDriveRootPath();
      const path = doc.file_path.startsWith("/") ? doc.file_path : `${rootPath}/Blitzvox_CRM/Vertraege/${doc.file_path}`;
      const fileUrl = `${HIDRIVE_URL}${path}`;
      const res = await fetch(fileUrl, {
        method: "GET",
        headers: getHiDriveAuthHeaders(),
      });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:${doc.mime_type || "application/pdf"};base64,${base64}`;
        return { success: true, document: doc, dataUrl };
      }
    }

    return { success: true, document: doc, dataUrl: null };
  });

// 6. Delete Contract Document from Strato HiDrive
export const deleteContractDocumentHiDrive = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { documentId } = data;

    const { data: doc } = await supabase
      .from("contract_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (doc && doc.file_path) {
      const rootPath = getHiDriveRootPath();
      const path = doc.file_path.startsWith("/") ? doc.file_path : `${rootPath}/Blitzvox_CRM/Vertraege/${doc.file_path}`;
      try {
        await fetch(`${HIDRIVE_URL}${path}`, {
          method: "DELETE",
          headers: getHiDriveAuthHeaders(),
        });
      } catch (e) {
        console.error("HiDrive delete error:", e);
      }
    }

    const { error: dbErr } = await supabase.from("contract_documents").delete().eq("id", documentId);
    if (dbErr) throw dbErr;
    return { success: true };
  });
