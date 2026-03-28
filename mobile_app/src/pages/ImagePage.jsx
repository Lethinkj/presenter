import { FaImage } from 'react-icons/fa';

export default function ImagePage({
  imageInputRef,
  imageRemoveMode,
  setImageRemoveMode,
  clearScreen,
  uploadedImages,
  activeImageId,
  presentImage,
  removeUploadedImage,
  handleImageUpload,
  displayImageSize,
  setDisplayImageSize
}) {
  return (
    <div className="image-share-panel">
      <div className="image-share-topbar">
        <button className="btn-save" onClick={() => imageInputRef.current?.click()}>
          <FaImage style={{ marginRight: 6 }} /> Upload Images
        </button>
        <button
          className={`image-remove-mode-btn ${imageRemoveMode ? 'active' : ''}`}
          onClick={() => setImageRemoveMode(v => !v)}
          title="Toggle remove mode"
        >
          {imageRemoveMode ? 'Done' : 'Remove'}
        </button>
        <button className="mini-clear-btn" onClick={clearScreen} title="Clear TV Screen">Clear</button>
        <span className="image-limit-text">{uploadedImages.length}/20 images</span>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
      </div>

      <div className="size-picker image-size-picker">
        <label>Image Size:</label>
        <button className="size-btn" onClick={() => setDisplayImageSize(prev => prev === 'auto' ? 80 : Math.max(20, prev - 5))}>-</button>
        <button className={`size-btn auto-btn ${displayImageSize === 'auto' ? 'active' : ''}`} onClick={() => setDisplayImageSize('auto')}>Auto</button>
        <button className="size-btn" onClick={() => setDisplayImageSize(prev => prev === 'auto' ? 80 : Math.min(200, prev + 5))}>+</button>
        <span className="size-val">{displayImageSize === 'auto' ? 'Fitting' : `${displayImageSize}%`}</span>
      </div>

      <div className="image-grid">
        {uploadedImages.length === 0 ? (
          <div className="image-empty">Upload images, then tap one to present it on TV.</div>
        ) : (
          uploadedImages.map(imageItem => (
            <button
              key={imageItem.id}
              className={`image-tile ${activeImageId === imageItem.id ? 'active' : ''}`}
              onClick={() => {
                if (!imageRemoveMode) presentImage(imageItem);
              }}
            >
              {imageRemoveMode && (
                <button
                  className="image-remove-btn"
                  title="Remove image"
                  aria-label="Remove image"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeUploadedImage(imageItem.id);
                  }}
                >
                  ×
                </button>
              )}
              <img src={imageItem.dataUrl} alt={imageItem.name} className="image-thumb" />
              <span className="image-name">{imageItem.name}</span>
              {activeImageId === imageItem.id && <span className="image-presented-badge">Presented</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
