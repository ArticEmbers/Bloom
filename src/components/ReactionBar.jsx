import { useState } from 'react'

const QUICK_REACTIONS = ['❤️', '😂', '😭', '✨', '🌸', '👍']

function ReactionBar({ reactions = [], userId, onToggle }) {
  const [open, setOpen] = useState(false)

  const grouped = reactions.reduce((map, reaction) => {
    const current = map.get(reaction.emoji) || { count: 0, mine: false }
    current.count += 1
    current.mine = current.mine || reaction.user_id === userId
    map.set(reaction.emoji, current)
    return map
  }, new Map())

  return (
    <div className="reaction-bar">
      {Array.from(grouped.entries()).map(([emoji, info]) => (
        <button
          key={emoji}
          type="button"
          className={`reaction-chip ${info.mine ? 'mine' : ''}`}
          onClick={() => onToggle(emoji)}
          title={`${info.count} reaction${info.count === 1 ? '' : 's'}`}
        >
          <span>{emoji}</span>
          <span>{info.count}</span>
        </button>
      ))}

      <div className="reaction-picker-wrap">
        <button
          type="button"
          className="reaction-add"
          onClick={() => setOpen((value) => !value)}
          aria-label="Add reaction"
          title="Add reaction"
        >
          +
        </button>

        {open && (
          <div className="reaction-picker" role="menu">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(emoji)
                  setOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReactionBar
