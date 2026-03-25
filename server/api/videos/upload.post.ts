/**
 * POST /api/videos/upload
 *
 * Server-side video record creation with upload-limit enforcement.
 *
 * Expected body:
 *   storagePath      – path in the "videos" Supabase Storage bucket
 *   title            – display name
 *   originalFilename – original file name from the user's machine
 *   fileSize?        – size in bytes
 *   mimeType?        – MIME type
 *
 * Flow:
 *   1. Authenticate
 *   2. Check upload limit (server-side — single source of truth)
 *   3. Create video record
 *   4. Increment upload counter
 *   5. Return video row
 */
export default defineEventHandler(async (event) => {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const user = await requireUser(event);

  // ── Validate body ─────────────────────────────────────────────────────────
  const body = await readBody(event);
  const { storagePath, title, originalFilename, fileSize, mimeType } = body;

  if (!storagePath || !title || !originalFilename) {
    throw createError({
      statusCode: 400,
      message: "storagePath, title, and originalFilename are required",
    });
  }

  // ── Upload limit enforcement (server-side) ────────────────────────────────
  const config = useRuntimeConfig();
  if (!config.bypassPayment) {
    const uploadCheck = await canUpload(user.id);
    if (!uploadCheck.allowed) {
      throw createError({
        statusCode: 429,
        data: buildDeniedPayload("UPLOAD", uploadCheck),
        message: "Monthly upload limit reached. Please upgrade your plan.",
      });
    }
  }

  // ── Create video record ───────────────────────────────────────────────────
  const supabase = useSupabaseAdmin();

  const { data: video, error } = await supabase
    .from("videos")
    .insert({
      user_id: user.id,
      title,
      original_filename: originalFilename,
      storage_path: storagePath,
      file_size: fileSize ?? null,
      mime_type: mimeType ?? null,
      status: "uploaded",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create video record:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create video record",
    });
  }

  // ── Increment counter (always, even during dev bypass) ────────────────────
  await incrementUploadCount(user.id);

  return video;
});
