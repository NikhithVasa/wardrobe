import { handleUpload } from "@vercel/blob/client";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const WARDROBE_PATH = /^wardrobe\/[a-f0-9-]{36}\/[^/]+$/i;


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
        if (!WARDROBE_PATH.test(pathname)) throw new Error("Invalid wardrobe upload path.");

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async () => {},
    });

    return response.status(200).json(result);
  } catch (error) {
    return response.status(400).json({ error: error.message || "The photo could not be uploaded." });
  }
}
