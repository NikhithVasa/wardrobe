import { list } from "@vercel/blob";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
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
