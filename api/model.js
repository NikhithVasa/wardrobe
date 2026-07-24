import { del, list } from "@vercel/blob";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!new Set(["GET", "DELETE"]).has(request.method)) {
    response.setHeader("Allow", "GET, DELETE");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (request.method === "DELETE") {
    try {
      const [{ blobs: modelPhotos }, { blobs: tryOnPhotos }] = await Promise.all([
        list({ prefix: "model/", limit: 100 }),
        list({ prefix: "tryon/", limit: 1000 }),
      ]);
      const urls = [...modelPhotos, ...tryOnPhotos].map((photo) => photo.url);
      if (urls.length) await del(urls);
      return response.status(200).json({ deleted: urls.length });
    } catch (error) {
      return response.status(500).json({ error: error.message || "Could not remove your photo." });
    }
  }

  try {
    const { blobs } = await list({ prefix: "model/", limit: 100 });
    const photo = blobs.sort((first, second) => new Date(second.uploadedAt) - new Date(first.uploadedAt))[0];
    return response.status(200).json(photo ? {
      url: photo.url,
      pathname: photo.pathname,
      uploadedAt: photo.uploadedAt,
    } : null);
  } catch (error) {
    return response.status(500).json({ error: error.message || "Could not load your photo." });
  }
}
