import { randomUUID } from "node:crypto";
import { del, list, put } from "@vercel/blob";
import sharp from "sharp";

export const maxDuration = 300;

const ITEM_ID = /^upload-([a-f0-9-]{36})$/i;
const PROMPT = `Create a realistic vertical fashion photograph of the exact person in Image 1 wearing the exact clothing item from Image 2.

Preserve the person's recognizable identity, face, hair, skin tone, age, body proportions, and pose. Preserve the clothing item's exact color, fabric, pattern, neckline, sleeves, fit, graphics, and construction. Put the item naturally on the person at the correct scale and position. Keep the rest of the person's outfit simple and complementary. Use realistic anatomy, fabric folds, lighting, and shadows.

The result should look like a natural photograph of this person wearing this specific item. Do not change the person's face or body shape. Do not add text, logos that are not present, watermarks, extra people, extra limbs, or duplicate clothing.`;

function requestBody(request) {
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  return request.body || {};
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

async function imageBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not read an uploaded photo.");
  const input = Buffer.from(await response.arrayBuffer());
  return sharp(input)
    .rotate()
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .toColorspace("srgb")
    .png()
    .toBuffer();
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!sameOrigin(request)) return response.status(403).json({ error: "Try-on requests must come from this wardrobe." });

  try {
    const { itemId } = requestBody(request);
    const uploadId = ITEM_ID.exec(itemId)?.[1];
    if (!uploadId) return response.status(400).json({ error: "Choose a valid wardrobe item." });
    if (!process.env.OPENAI_API_KEY) return response.status(503).json({ error: "OpenAI is not configured for try-on." });

    const [{ blobs: garments }, { blobs: modelPhotos }] = await Promise.all([
      list({ prefix: `wardrobe/${uploadId}/`, limit: 10 }),
      list({ prefix: "model/", limit: 100 }),
    ]);
    const garment = garments[0];
    const modelPhoto = modelPhotos.sort((first, second) => new Date(second.uploadedAt) - new Date(first.uploadedAt))[0];
    if (!garment) return response.status(404).json({ error: "That clothing photo is no longer available." });
    if (!modelPhoto) return response.status(400).json({ error: "Add your photo before trying on a piece." });

    const [personBytes, garmentBytes] = await Promise.all([
      imageBytes(modelPhoto.url),
      imageBytes(garment.url),
    ]);
    const form = new FormData();
    form.set("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
    form.set("prompt", PROMPT);
    form.set("size", "1024x1536");
    form.set("quality", process.env.OPENAI_IMAGE_QUALITY || "high");
    form.set("output_format", "png");
    form.append("image[]", new Blob([personBytes], { type: "image/png" }), "person.png");
    form.append("image[]", new Blob([garmentBytes], { type: "image/png" }), "clothing.png");

    const openAIResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    const result = await openAIResponse.json().catch(() => ({}));
    if (!openAIResponse.ok) throw new Error(result.error?.message || `OpenAI image request failed (${openAIResponse.status}).`);
    const encoded = result.data?.[0]?.b64_json;
    if (!encoded) throw new Error("OpenAI did not return a try-on image.");

    const prefix = `tryon/${uploadId}/`;
    const { blobs: previous } = await list({ prefix, limit: 100 });
    const output = await put(`${prefix}${randomUUID()}.png`, Buffer.from(encoded, "base64"), {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/png",
    });
    if (previous.length) await del(previous.map((photo) => photo.url));

    return response.status(200).json({ modeledImage: output.url });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Could not create the try-on photo." });
  }
}
