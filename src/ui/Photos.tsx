import { useState } from 'react';
import { type LinkedPhoto, addPhoto, makeMainPhoto, removePhoto, typeKey, unitKey, unitPhotoKeys, usePhotoUrl, usePhotos } from '../photos';
import { Modal } from './common';

export interface PhotoTarget {
  /** Datasheet entry id: photos shared by every unit of this type. */
  entryId?: string;
  /** Roster selection uid: photos for this one unit. */
  selUid?: string;
  /** Datasheet name, e.g. "Necron Warriors". */
  typeName: string;
}

function Img({ id, size, className, alt }: { id: string; size?: number; className?: string; alt: string }) {
  const url = usePhotoUrl(id);
  if (!url) return <span className={`thumb ${className ?? ''}`} style={size ? { width: size, height: size } : undefined} aria-label={alt} />;
  return <img src={url} alt={alt} className={`thumb ${className ?? ''}`} style={size ? { width: size, height: size } : undefined} />;
}

/** Small round thumbnail of a unit's main photo (renders nothing if it has none). */
export function UnitThumb({ entryId, selUid, size = 36, alt }: { entryId?: string; selUid?: string; size?: number; alt: string }) {
  const photos = usePhotos(unitPhotoKeys(entryId, selUid));
  if (!photos.length) return null;
  return <Img id={photos[0].id} size={size} className="round" alt={alt} />;
}

function Viewer({ photo, target, onClose }: { photo: LinkedPhoto; target: PhotoTarget; onClose: () => void }) {
  const url = usePhotoUrl(photo.id);
  const shared = photo.key.startsWith('type:');
  return (
    <Modal onClose={onClose} title={target.typeName}>
      {url && <img src={url} alt={target.typeName} style={{ width: '100%', borderRadius: 8, display: 'block' }} />}
      <p className="small muted">{shared ? `Shown for every ${target.typeName} unit.` : 'Shown for this unit only.'}</p>
      <div className="row">
        <button
          onClick={() => {
            makeMainPhoto(photo.key, photo.id);
            onClose();
          }}
        >
          Make main photo
        </button>
        <button
          className="danger"
          onClick={async () => {
            if (!confirm('Delete this photo?')) return;
            await removePhoto(photo.id);
            onClose();
          }}
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}

/** Photo strip with add / view / delete for a unit. */
export function PhotoManager({ target }: { target: PhotoTarget }) {
  const photos = usePhotos(unitPhotoKeys(target.entryId, target.selUid));
  const [scope, setScope] = useState<'type' | 'unit'>(target.entryId ? 'type' : 'unit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<LinkedPhoto | null>(null);

  const key = scope === 'type' && target.entryId ? typeKey(target.entryId) : target.selUid ? unitKey(target.selUid) : undefined;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !key) return;
    setBusy(true);
    setError('');
    try {
      for (const f of Array.from(files)) await addPhoto(f, key);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
    setBusy(false);
  };

  return (
    <div className="photos">
      <div className="photo-strip">
        {photos.map((p, i) => (
          <button key={p.id} className="photo-btn" onClick={() => setViewing(p)} aria-label={`View photo ${i + 1}`}>
            <Img id={p.id} alt={`${target.typeName} photo ${i + 1}`} />
            {p.key.startsWith('unit:') && <span className="photo-badge">this unit</span>}
          </button>
        ))}
        {!photos.length && <span className="tiny muted">No photos yet. Add a picture of your painted models.</span>}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <label className="btn small">
          📷 Take photo
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
        </label>
        <label className="btn small">
          🖼 Choose…
          <input type="file" accept="image/*" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
        </label>
        {target.entryId && target.selUid && (
          <select value={scope} onChange={(e) => setScope(e.target.value as 'type' | 'unit')} aria-label="Photo applies to" style={{ minHeight: 30, padding: '2px 6px' }}>
            <option value="type">For every {target.typeName}</option>
            <option value="unit">For this unit only</option>
          </select>
        )}
        {busy && <span className="spinner" />}
      </div>
      {error && <p className="small red">{error}</p>}
      {viewing && <Viewer photo={viewing} target={target} onClose={() => setViewing(null)} />}
    </div>
  );
}
