import { useMemo } from 'react'

function youtubeId(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1).split('/')[0]
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2]
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2]
    }
  } catch {}
  return null
}

function tiktokId(url) {
  const match = String(url).match(/tiktok\.com\/(?:@[^/]+\/video\/|player\/v1\/)(\d+)/i)
  return match?.[1] || null
}

export default function MediaLinkPreview({ text }) {
  const preview = useMemo(() => {
    const urls = String(text || '').match(/https?:\/\/[^\s<>]+/gi) || []
    for (const raw of urls) {
      const url = raw.replace(/[),.!?]+$/, '')
      const yt = youtubeId(url)
      if (yt) return { type: 'youtube', id: yt, url }
      const tt = tiktokId(url)
      if (tt) return { type: 'tiktok', id: tt, url }
    }
    return null
  }, [text])

  if (!preview) return null

  const src = preview.type === 'youtube'
    ? `https://www.youtube.com/embed/${preview.id}?rel=0`
    : `https://www.tiktok.com/player/v1/${preview.id}?controls=1&description=1&music_info=1`

  return (
    <div className={`media-link-preview ${preview.type}`}>
      <div className="media-link-preview-label">{preview.type === 'youtube' ? 'YouTube' : 'TikTok'}</div>
      <div className="media-link-preview-frame">
        <iframe
          src={src}
          title={`${preview.type} preview`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <a href={preview.url} target="_blank" rel="noreferrer" className="media-link-preview-link">Open original ↗</a>
    </div>
  )
}
