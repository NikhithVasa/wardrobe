import { timingSafeEqual } from "node:crypto";
import { del, list } from "@vercel/blob";

const PREFIX = "wardrobe/";

function matchesSecret(value) {
  const expected = process.env.WARDROBE_UPLOAD_PASSWORD || "";
  if (!value || !expected) return false;

  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

function itemFromBlob(blob) {
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
    modeledImage: null,
    uploadedAt: blob.uploadedAt,
  };
}

async function loadWardrobe() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  return blobs
    .filter((blob) => blob.pathname.split("/").length === 3)
    .sort((first, second) => new Date(second.uploadedAt) - new Date(first.uploadedAt))
    .map(itemFromBlob);
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
    const password = request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
    if (!matchesSecret(password)) return response.status(401).json({ error: "The upload passcode is incorrect." });

    const item = (await loadWardrobe()).find((entry) => entry.id === request.query.id);
    if (!item) return response.status(404).json({ error: "Wardrobe item not found." });

    await del(item.image);
    return response.status(200).json({ deleted: true, id: item.id });
  }

  response.setHeader("Allow", "GET, DELETE");
  return response.status(405).json({ error: "Method not allowed" });
}
