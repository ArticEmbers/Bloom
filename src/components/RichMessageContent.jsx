import { Fragment } from 'react'
import { replaceEmojiShortcodes } from './EmojiShortcodes'

function renderTextWithShortcodes(text) {
  const parts = String(text || '').split(/(:[a-zA-Z0-9_+\-]+:)/g)
  return parts.map((part, index) => {
    const match = part.match(/^:([a-zA-Z0-9_+\-]+):$/)
    if (!match) return <Fragment key={index}>{part}</Fragment>
    const replaced = replaceEmojiShortcodes(part)
    return replaced !== part
      ? <span key={index} className="message-emoji" title={part}>{replaced}</span>
      : <Fragment key={index}>{part}</Fragment>
  })
}

function MentionText({ text, users = [], roles = [], onUserClick }) {
  const userMap = new Map(
    users
      .filter(Boolean)
      .map((user) => [String(user.username || '').toLowerCase(), user])
  )
  const roleMap = new Map(
    roles
      .filter(Boolean)
      .map((role) => [String(role.name || '').toLowerCase().replace(/\s+/g, '-'), role])
  )

  const parts = String(text || '').split(/(@[A-Za-z0-9_.-]+)/g)

  return parts.flatMap((part, index) => {
    if (!part.startsWith('@')) return [<Fragment key={`text-${index}`}>{renderTextWithShortcodes(part)}</Fragment>]

    const handle = part.slice(1).toLowerCase()
    const user = userMap.get(handle)
    const role = roleMap.get(handle)

    if (user) {
      return [
        <button
          key={`user-${index}`}
          type="button"
          className="message-mention user-mention"
          onClick={() => onUserClick?.(user.id)}
          title={`View ${user.username}'s profile`}
        >
          @{user.username}
        </button>,
      ]
    }

    if (role) {
      return [
        <span
          key={`role-${index}`}
          className="message-mention role-mention"
          title={`Role: ${role.name}`}
        >
          @{role.name}
        </span>,
      ]
    }

    return [<Fragment key={`unknown-${index}`}>{renderTextWithShortcodes(part)}</Fragment>]
  })
}

function RichMessageContent({ text, users, roles, onUserClick }) {
  if (!text) return null

  const blocks = []
  let cursor = 0
  const fence = /```(?:([\w+-]+)\n)?([\s\S]*?)```/g
  let match

  while ((match = fence.exec(text))) {
    if (match.index > cursor) {
      blocks.push({ type: 'text', value: text.slice(cursor, match.index) })
    }
    blocks.push({ type: 'code', language: match[1] || '', value: match[2] || '' })
    cursor = fence.lastIndex
  }

  if (cursor < text.length) {
    blocks.push({ type: 'text', value: text.slice(cursor) })
  }

  return (
    <div className="rich-message-content">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'code') {
          return (
            <pre className="message-code-block" key={`code-${blockIndex}`}>
              {block.language && (
                <span className="message-code-language">{block.language}</span>
              )}
              <code>{block.value.replace(/^\n/, '')}</code>
            </pre>
          )
        }

        const lines = block.value.split('\n')
        return (
          <Fragment key={`text-${blockIndex}`}>
            {lines.map((line, lineIndex) => {
              const quoted = line.trimStart().startsWith('>')
              const visible = quoted ? line.trimStart().slice(1).replace(/^ ?/, '') : line

              return (
                <Fragment key={lineIndex}>
                  {quoted ? (
                    <blockquote className="message-quote">
                      <MentionText
                        text={visible}
                        users={users}
                        roles={roles}
                        onUserClick={onUserClick}
                      />
                    </blockquote>
                  ) : (
                    <span className="message-line">
                      <MentionText
                        text={line}
                        users={users}
                        roles={roles}
                        onUserClick={onUserClick}
                      />
                    </span>
                  )}
                  {lineIndex < lines.length - 1 && <br />}
                </Fragment>
              )
            })}
          </Fragment>
        )
      })}
    </div>
  )
}

export default RichMessageContent
