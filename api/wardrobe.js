import { del, list } from "@vercel/blob";

const PREFIX = "wardrobe/";


function itemFromBlob(blob, modeledImage) {
  const [, uploadId, filename = "Dress"] = blob.pathname.split("/");
  const name = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());

  return {
    id: `upload-${uploadId}`,
    name: name || "Dress",
    part: "dresses",
    color: "#d8d0c2",
    secondaryColor: null,
    tags: [],
    palette: [],
    image: blob.url,
    thumbnail: blob.url,
    modeledImage: modeledImage || null,
    uploadedAt: blob.uploadedAt,
  };
}

async function loadWardrobe() {
  const [{ blobs }, { blobs: tryOnPhotos }] = await Promise.all([
    list({ prefix: PREFIX, limit: 1000 }),
    list({ prefix: "tryon/", limit: 1000 }),
  ]);
  const modeledByUpload = new Map();
  for (const photo of tryOnPhotos.sort((first, second) => new Date(second.uploadedAt) - new Date(first.uploadedAt))) {
    const [, uploadId] = photo.pathname.split("/");
    if (uploadId && !modeledByUpload.has(uploadId)) modeledByUpload.set(uploadId, photo.url);
  }

  return blobs
    .filter((blob) => blob.pathname.split("/").length === 3)
    .sort((first, second) => new Date(second.uploadedAt) - new Date(first.uploadedAt))
    .map((blob) => {
      const [, uploadId] = blob.pathname.split("/");
      return itemFromBlob(blob, modeledByUpload.get(uploadId));
    });
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "GET") {
    try {
      return response.status(200).json(await loadWardrobe());
    } catch (error) {
      return response.status(500).json({ error: error.message || "Could not load the wardrobe." });
    }
  }

  if (request.method === "DELETE") {
    const item = (await loadWardrobe()).find((entry) => entry.id === request.query.id);
    if (!item) return response.status(404).json({ error: "Wardrobe item not found." });

    await del([item.image, item.modeledImage].filter(Boolean));
    return response.status(200).json({ deleted: true, id: item.id });
  }

  response.setHeader("Allow", "GET, DELETE");
  return response.status(405).json({ error: "Method not allowed" });
}
