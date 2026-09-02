function ReplyPreview({ reply, compact = false, onCancel, onClick }) {
  if (!reply) return null

  const username =
    reply.profiles?.username ||
    reply.sender?.username ||
    'Unknown'
  const rawContent = reply.content || (reply.media_url ? 'Attachment' : 'Message')
  const content = rawContent.trim().slice(0, 40) + (rawContent.trim().length > 40 ? '…' : '')

  return (
    <button
      type={onClick ? 'button' : undefined}
      className={`reply-preview ${compact ? 'compact' : ''} ${onClick ? 'reply-preview-clickable' : ''}`}
      onClick={onClick}
    >
      <span className="reply-accent" />
      <span className="reply-copy">
        <strong>{compact ? `Replying to ${username}` : `Reply to ${username}`}</strong>
        <span>{content || 'Message'}</span>
      </span>
      {onCancel && (
        <span
          role="button"
          tabIndex={0}
          className="reply-dismiss"
          onClick={(event) => {
            event.stopPropagation()
            onCancel()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              onCancel()
            }
          }}
          aria-label="Cancel reply"
        >
          ×
        </span>
      )}
    </button>
  )
}

export default ReplyPreview
