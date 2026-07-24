import { useRef, useState } from "react";
import { Camera, Check, ImageSquare, Plus, SpinnerGap, X } from "@phosphor-icons/react";
import { upload } from "@vercel/blob/client";
import "./import-flow.css";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function safeFilename(filename) {
  const normalized = filename.normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "dress.jpg";
}

function uploadedItem(blob, file, uploadId) {
  return {
    id: `upload-${uploadId}`,
    name: file.name.replace(/\.[^.]+$/, "") || "Dress",
    part: "dresses",
    color: "#d8d0c2",
    secondaryColor: null,
    tags: [],
    palette: [],
    image: blob.url,
    thumbnail: blob.url,
    modeledImage: null,
    uploadedAt: new Date().toISOString(),
  };
}

export function WardrobeUploadFlow({ onUploaded }) {
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const chooseFiles = async (files) => {
    const selected = [...files];
    if (!selected.length) return;

    const invalid = selected.find((file) => !ALLOWED_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES);
    if (invalid) {
      setError(`${invalid.name} must be a JPG, PNG, WebP, HEIC, or HEIF image under 25 MB.`);
      setOpen(true);
      return;
    }

    setBusy(true);
    setOpen(true);
    setError("");

    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        const uploadId = crypto.randomUUID();
        const blob = await upload(`wardrobe/${uploadId}/${safeFilename(file.name)}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          multipart: true,
          onUploadProgress: ({ percentage }) => {
            setProgress(Math.round(((index + (percentage / 100)) / selected.length) * 100));
          },
        });
        onUploaded(uploadedItem(blob, file, uploadId));
      }

      setProgress(100);
      setMessage(`${selected.length} ${selected.length === 1 ? "dress" : "dresses"} added to the wardrobe.`);
    } catch (requestError) {
      const detail = requestError.message || "The photos could not be uploaded.";
      setError(detail);
    } finally {
      setBusy(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(event) => chooseFiles(event.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => chooseFiles(event.target.files)}
      />

      <aside className="import-tray is-expanded" aria-label="Add dresses">
        <button className="import-tray__button" type="button" onClick={() => setOpen(true)} aria-label="Add dresses">
          {busy ? <SpinnerGap size={19} className="import-spinner" /> : message ? <Check size={19} weight="bold" /> : <Plus size={19} />}
        </button>
        <div className="import-tray__actions">
          <span className="import-tray__label">{busy ? `Uploading ${progress}%` : message || "Add dresses"}</span>
          <button className="import-icon-button" type="button" onClick={() => galleryInputRef.current?.click()} aria-label="Choose dress photos" disabled={busy}>
            <ImageSquare size={18} />
          </button>
          <button className="import-icon-button" type="button" onClick={() => cameraInputRef.current?.click()} aria-label="Take a dress photo" disabled={busy}>
            <Camera size={18} />
          </button>
        </div>
      </aside>

      <div className="import-popover-backdrop" data-open={open} onMouseDown={(event) => event.target === event.currentTarget && !busy && setOpen(false)}>
        <section className="import-popover mobile-upload-popover" role="dialog" aria-modal="true" aria-labelledby="upload-title">
          <header className="import-popover__header">
            <div>
              <p className="import-popover__eyebrow">Harini's wardrobe</p>
              <h2 className="import-popover__title" id="upload-title">Add a dress</h2>
            </div>
            <button className="import-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close" disabled={busy}><X size={20} /></button>
          </header>

          <div className="mobile-upload-content">

            <div className="mobile-upload-actions">
              <button className="import-button import-button--primary" type="button" onClick={() => cameraInputRef.current?.click()} disabled={busy}><Camera size={18} /> Take a photo</button>
              <button className="import-button" type="button" onClick={() => galleryInputRef.current?.click()} disabled={busy}><ImageSquare size={18} /> Choose photos</button>
            </div>

            {busy && <div className="import-progress is-reviewing" role="status" aria-live="polite"><div className="import-progress__meta"><span>Uploading photos</span><span>{progress}%</span></div><div className="import-progress__track"><div className="import-progress__bar" style={{ "--import-progress": `${progress}%` }} /></div></div>}
            {message && !busy && <p className="import-status is-complete" role="status">{message}</p>}
            {error && <p className="import-status is-error" role="alert">{error}</p>}
          </div>
        </section>
      </div>
    </>
  );
}
