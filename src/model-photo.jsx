import { useRef, useState } from "react";
import { SpinnerGap, UserCirclePlus } from "@phosphor-icons/react";
import { upload } from "@vercel/blob/client";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function safeFilename(filename) {
  const normalized = filename.normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "my-photo.jpg";
}

export function ModelPhotoControl({ photo, onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choosePhoto = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES) {
      setError("Choose a JPG, PNG, WebP, HEIC, or HEIF photo under 25 MB.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const uploadId = crypto.randomUUID();
      const blob = await upload(`model/${uploadId}/${safeFilename(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: true,
      });
      onUploaded({ url: blob.url, pathname: blob.pathname, uploadedAt: new Date().toISOString() });
    } catch (requestError) {
      setError(requestError.message || "Your photo could not be uploaded.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="model-photo-control">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(event) => choosePhoto(event.target.files)} />
      <button className="model-photo-button" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <SpinnerGap size={20} className="import-spinner" aria-hidden="true" /> : photo ? <img src={photo.url} alt="" /> : <UserCirclePlus size={22} weight="duotone" aria-hidden="true" />}
        <span><strong>{busy ? "Uploading photo" : photo ? "Change my photo" : "Add my photo"}</strong><small>Clear full-body photo works best</small></span>
      </button>
      {error && <p className="model-photo-error" role="alert">{error}</p>}
    </div>
  );
}
