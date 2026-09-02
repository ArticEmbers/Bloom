import { useEffect, useState } from 'react'

const MAX_TEXT_BYTES = 512 * 1024

function TextAttachment({ url, fileName = 'text.txt' }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadText() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const length = Number(response.headers.get('content-length') || 0)
        if (length > MAX_TEXT_BYTES) throw new Error('Text file is too large to preview.')

        const value = await response.text()
        if (!cancelled) setText(value.slice(0, MAX_TEXT_BYTES))
      } catch (err) {
        if (err?.name !== 'AbortError' && !cancelled) {
          setError('Could not preview this text file.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadText()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [url])

  return (
    <div className="message-text-attachment">
      <div className="message-text-attachment-header">
        <span className="message-text-attachment-name">{fileName}</span>
        <a href={url} target="_blank" rel="noreferrer" className="message-text-download">
          Open
        </a>
      </div>
      <div className="message-text-attachment-body">
        {loading && <div className="message-text-loading">Loading text…</div>}
        {!loading && error && <div className="message-text-error">{error}</div>}
        {!loading && !error && <pre className="message-text-content">{text}</pre>}
      </div>
    </div>
  )
}

export default TextAttachment
