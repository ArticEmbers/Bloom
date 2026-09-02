/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react'
import './MediaCropper.css'

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const MAX_PREVIEW_DIMENSION = 2048

const OUTPUT_SIZES = {
  avatar: { width: 512, height: 512 },
  banner: { width: 1200, height: 400 },
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function MediaCropper({
  file,
  type = 'avatar',
  onCancel,
  onConfirm,
}) {
  const imageRef = useRef(null)
  const cropAreaRef = useRef(null)
  const wasDraggingRef = useRef(false)

  const [previewUrl, setPreviewUrl] = useState('')
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [mediaType, setMediaType] = useState('image')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const isAvatar = type === 'avatar'
  const outputSize = OUTPUT_SIZES[isAvatar ? 'avatar' : 'banner']

  useEffect(() => {
    let cancelled = false
    let sourceUrl = ''
    let normalizedUrl = ''

    async function preparePreview() {
      if (!file) return

      sourceUrl = URL.createObjectURL(file)
      const isGif = file.type === 'image/gif'
      setMediaType(isGif ? 'gif' : 'image')
      setImageLoaded(false)
      setZoom(1)
      setPosition({ x: 0, y: 0 })

      // GIFs stay untouched so animation is preserved.
      if (isGif) {
        if (!cancelled) setPreviewUrl(sourceUrl)
        return
      }

      const image = new Image()
      image.decoding = 'async'
      image.onload = async () => {
        if (cancelled) return

        const largestSide = Math.max(image.naturalWidth, image.naturalHeight)
        if (largestSide <= MAX_PREVIEW_DIMENSION) {
          setPreviewUrl(sourceUrl)
          return
        }

        // Normalize oversized photos before the cropper uses them.
        // This makes very large camera/phone images behave like smaller
        // profile media while keeping the final crop dimensions fixed.
        const scale = MAX_PREVIEW_DIMENSION / largestSide
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

        const context = canvas.getContext('2d')
        if (!context) {
          setPreviewUrl(sourceUrl)
          return
        }

        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const normalizedBlob = await new Promise((resolve) =>
          canvas.toBlob(resolve, outputMime, outputMime === 'image/jpeg' ? 0.94 : undefined),
        )

        if (cancelled) return

        if (!normalizedBlob) {
          setPreviewUrl(sourceUrl)
          return
        }

        normalizedUrl = URL.createObjectURL(normalizedBlob)
        setPreviewUrl(normalizedUrl)
      }

      image.onerror = () => {
        if (!cancelled) setPreviewUrl(sourceUrl)
      }
      image.src = sourceUrl
    }

    preparePreview()

    return () => {
      cancelled = true
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
      if (normalizedUrl) URL.revokeObjectURL(normalizedUrl)
    }
  }, [file])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const getCropMetrics = useMemo(() => {
    return () => {
      const image = imageRef.current
      const cropArea = cropAreaRef.current

      if (!image || !cropArea || !image.naturalWidth || !image.naturalHeight) {
        return null
      }

      const rect = cropArea.getBoundingClientRect()
      const cropWidth = rect.width
      const cropHeight = rect.height
      const baseScale = Math.max(
        cropWidth / image.naturalWidth,
        cropHeight / image.naturalHeight,
      )
      const scale = baseScale * zoom
      const imageWidth = image.naturalWidth * scale
      const imageHeight = image.naturalHeight * scale
      const maxX = Math.max(0, (imageWidth - cropWidth) / 2)
      const maxY = Math.max(0, (imageHeight - cropHeight) / 2)

      return {
        cropWidth,
        cropHeight,
        baseScale,
        scale,
        imageWidth,
        imageHeight,
        maxX,
        maxY,
      }
    }
  }, [zoom])

  useEffect(() => {
    if (!imageLoaded || mediaType === 'gif') return

    const metrics = getCropMetrics()
    if (!metrics) return

    setPosition((current) => ({
      x: clamp(current.x, -metrics.maxX, metrics.maxX),
      y: clamp(current.y, -metrics.maxY, metrics.maxY),
    }))
  }, [getCropMetrics, imageLoaded, mediaType])

  function handleZoomChange(event) {
    const nextZoom = Number(event.target.value)
    setZoom(nextZoom)
  }

  function startDrag(clientX, clientY) {
    if (mediaType === 'gif') return

    setDragging(true)
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y,
    })
  }

  function moveDrag(clientX, clientY) {
    if (!dragging) return

    const metrics = getCropMetrics()
    const rawX = clientX - dragStart.x
    const rawY = clientY - dragStart.y

    if (!metrics) {
      setPosition({ x: rawX, y: rawY })
      return
    }

    setPosition({
      x: clamp(rawX, -metrics.maxX, metrics.maxX),
      y: clamp(rawY, -metrics.maxY, metrics.maxY),
    })
  }

  function handleMouseDown(event) {
    event.preventDefault()
    startDrag(event.clientX, event.clientY)
  }

  function handleMouseMove(event) {
    moveDrag(event.clientX, event.clientY)
  }

  function handleTouchStart(event) {
    const touch = event.touches[0]
    if (!touch) return
    startDrag(touch.clientX, touch.clientY)
  }

  function handleTouchMove(event) {
    const touch = event.touches[0]
    if (!touch) return
    moveDrag(touch.clientX, touch.clientY)
  }

  function stopDrag() {
    if (dragging) {
      wasDraggingRef.current = true
      window.setTimeout(() => {
        wasDraggingRef.current = false
      }, 0)
    }

    setDragging(false)
  }

  function resetCrop() {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  async function confirmCrop() {
    if (!file || !previewUrl || saving) return

    // Keep animated GIFs intact. Canvas rendering would flatten the animation.
    if (mediaType === 'gif') {
      onConfirm({ file, crop: null })
      return
    }

    const image = imageRef.current
    if (!image || !imageLoaded) return

    const naturalWidth = image.naturalWidth
    const naturalHeight = image.naturalHeight
    if (!naturalWidth || !naturalHeight) return

    const metrics = getCropMetrics()
    if (!metrics) return

    setSaving(true)

    try {
      // Clamp one final time so the exported bitmap can never contain a black gap.
      const safeX = clamp(position.x, -metrics.maxX, metrics.maxX)
      const safeY = clamp(position.y, -metrics.maxY, metrics.maxY)

      const canvas = document.createElement('canvas')
      canvas.width = outputSize.width
      canvas.height = outputSize.height

      const context = canvas.getContext('2d')
      if (!context) return

      // The preview and export both use the exact same centered transform:
      // 1) cover the crop frame, 2) apply zoom, 3) apply drag offset.
      // No browser layout dimensions are guessed beyond the actual crop frame.
      const drawScale = metrics.scale
      const drawnWidth = naturalWidth * drawScale
      const drawnHeight = naturalHeight * drawScale

      const outputScaleX = outputSize.width / metrics.cropWidth
      const outputScaleY = outputSize.height / metrics.cropHeight

      const drawWidth = drawnWidth * outputScaleX
      const drawHeight = drawnHeight * outputScaleY
      const offsetX = safeX * outputScaleX
      const offsetY = safeY * outputScaleY

      const drawX = outputSize.width / 2 - drawWidth / 2 + offsetX
      const drawY = outputSize.height / 2 - drawHeight / 2 + offsetY

      context.clearRect(0, 0, outputSize.width, outputSize.height)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight)

      const isPng = file.type === 'image/png'
      const outputType = isPng ? 'image/png' : 'image/jpeg'
      const extension = isPng ? 'png' : 'jpg'

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, outputType, 0.94),
      )

      if (!blob) return

      const croppedFile = new File(
        [blob],
        `cropped-${type}-${Date.now()}.${extension}`,
        { type: outputType },
      )

      onConfirm({
        file: croppedFile,
        crop: {
          zoom,
          positionX: safeX,
          positionY: safeY,
          type,
        },
      })
    } finally {
      setSaving(false)
    }
  }

  function handleOverlayClick(event) {
    if (wasDraggingRef.current) return
    if (event.target === event.currentTarget) onCancel?.()
  }

  if (!file || !previewUrl) return null

  const imageStyle = mediaType === 'gif'
    ? undefined
    : (() => {
        const metrics = getCropMetrics()
        if (!metrics) {
          return {
            width: '100%',
            height: '100%',
            left: '50%',
            top: '50%',
          }
        }

        return {
          width: `${metrics.imageWidth}px`,
          height: `${metrics.imageHeight}px`,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
        }
      })()

  return (
    <div
      className="cropper-overlay"
      onClick={handleOverlayClick}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onTouchMove={handleTouchMove}
      onTouchEnd={stopDrag}
    >
      <div className="cropper-modal" role="dialog" aria-modal="true" aria-labelledby="cropper-title">
        <div className="cropper-header">
          <div>
            <span className="cropper-kicker">PROFILE CUSTOMIZATION</span>
            <h2 id="cropper-title">
              {isAvatar ? 'Adjust profile picture' : 'Adjust profile banner'}
            </h2>
          </div>

          <button
            type="button"
            className="cropper-close"
            onClick={onCancel}
            aria-label="Close image editor"
          >
            ×
          </button>
        </div>

        <div className="cropper-body">
          <div
            ref={cropAreaRef}
            className={isAvatar ? 'crop-area avatar-crop-area' : 'crop-area banner-crop-area'}
          >
            <img
              ref={imageRef}
              src={previewUrl}
              alt="Crop preview"
              className={mediaType === 'gif' ? 'crop-media crop-media-static' : 'crop-media'}
              draggable="false"
              onLoad={() => setImageLoaded(true)}
              style={imageStyle}
              onMouseDown={mediaType === 'gif' ? undefined : handleMouseDown}
              onTouchStart={mediaType === 'gif' ? undefined : handleTouchStart}
            />

            <div className="crop-overlay">
              <div className="crop-frame" />
            </div>
          </div>

          {mediaType === 'gif' ? (
            <div className="gif-notice">
              ✦ GIF detected — animation will be preserved. Zoom and drag are disabled for animated files.
            </div>
          ) : (
            <p className="cropper-help">
              Drag the image to reposition it. Large images are automatically normalized for smoother editing, while the crop frame stays fully covered.
            </p>
          )}

          <div className={mediaType === 'gif' ? 'cropper-controls cropper-controls-disabled' : 'cropper-controls'}>
            <div className="zoom-control">
              <span className="zoom-icon" aria-hidden="true">−</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.01"
                value={zoom}
                onChange={handleZoomChange}
                disabled={mediaType === 'gif'}
                aria-label="Zoom"
              />
              <span className="zoom-icon" aria-hidden="true">+</span>
              <output className="zoom-value">{zoom.toFixed(2)}×</output>
            </div>

            <button
              type="button"
              className="cropper-reset"
              onClick={resetCrop}
              disabled={mediaType === 'gif'}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="cropper-footer">
          <button type="button" className="cropper-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="cropper-confirm"
            onClick={confirmCrop}
            disabled={saving || (mediaType !== 'gif' && !imageLoaded)}
          >
            {saving ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MediaCropper
