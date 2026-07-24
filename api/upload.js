import { handleUpload } from "@vercel/blob/client";
import { del, list } from "@vercel/blob";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const UPLOAD_PATH = /^(wardrobe|model)\/[a-f0-9-]{36}\/[^/]+$/i;


export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await handleUpload({
      body: request.body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!UPLOAD_PATH.test(pathname)) throw new Error("Invalid upload path.");

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        if (!blob.pathname.startsWith("model/")) return;

        const [{ blobs: modelPhotos }, { blobs: tryOnPhotos }] = await Promise.all([
          list({ prefix: "model/", limit: 100 }),
          list({ prefix: "tryon/", limit: 1000 }),
        ]);
        const staleUrls = [
          ...modelPhotos.filter((photo) => photo.url !== blob.url).map((photo) => photo.url),
          ...tryOnPhotos.map((photo) => photo.url),
        ];
        if (staleUrls.length) await del(staleUrls);
      },
    });

    return response.status(200).json(result);
  } catch (error) {
    return response.status(400).json({ error: error.message || "The photo could not be uploaded." });
  }
}
