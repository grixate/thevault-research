import { z } from "zod";

export const requestSchema = z.object({
  route: z.string().min(1),
  payload: z.unknown().optional()
});

export const fileImportSchema = z.object({
  file_path: z.string().min(1),
  title: z.string().optional(),
  type: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const audioRecordingSchema = z.object({
  data: z.custom<ArrayBuffer | ArrayBufferView>((value) => value instanceof ArrayBuffer || ArrayBuffer.isView(value)),
  mimeType: z.string().max(96).optional()
});

export const textFileSaveSchema = z.object({
  filename: z.string().min(1).max(160),
  contents: z.string().max(5_000_000),
  mimeType: z.string().max(96).optional()
});
