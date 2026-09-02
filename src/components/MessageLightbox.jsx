function MessageLightbox({ src, onClose }) {
  if (!src) return null

  return (
    <div className="media-lightbox" onClick={onClose} role="presentation">
      <button
        type="button"
        className="media-lightbox-close"
        onClick={onClose}
        aria-label="Close image"
      >
        ×
      </button>
      <img
        src={src}
        alt="Full-size attachment"
        className="media-lightbox-image"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}

export default MessageLightbox
