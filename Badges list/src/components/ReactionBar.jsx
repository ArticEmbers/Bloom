import { useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const NOTE_PREFIX = 'note:'

const COMMON_NAMES = {
  '😀': 'grinning face smile happy', '😃': 'grinning big eyes', '😄': 'grinning smiling eyes', '😁': 'beaming grin',
  '😆': 'grinning squint laughing', '😅': 'grinning sweat awkward', '😂': 'joy tears laughing laugh', '🤣': 'rofl rolling floor laugh',
  '😊': 'smiling blush', '😇': 'innocent angel halo', '🙂': 'slightly smiling', '🙃': 'upside down', '😉': 'wink', '😌': 'relieved',
  '😍': 'heart eyes love', '🥰': 'smiling hearts love', '😘': 'kiss', '😗': 'kissing', '😙': 'kissing smiling', '😚': 'kissing closed eyes',
  '😋': 'yum delicious', '😛': 'tongue', '😝': 'stuck out tongue', '🤗': 'hugging', '🤔': 'thinking', '🤭': 'hand mouth',
  '🤫': 'shushing quiet', '🤐': 'zipper mouth', '😐': 'neutral', '😑': 'expressionless', '😶': 'no mouth', '🙄': 'rolling eyes',
  '😏': 'smirk', '😣': 'persevere', '😥': 'sad relieved', '😮': 'open mouth surprised', '🤐': 'quiet zipper', '😯': 'hushed',
  '😲': 'astonished shocked', '🥺': 'pleading puppy', '😳': 'flushed embarrassed', '🥵': 'hot sweating', '🥶': 'cold freezing',
  '😱': 'scream fear', '😨': 'fear scared', '😰': 'anxious sweat', '😢': 'cry sad', '😭': 'sob crying tears', '😤': 'triumph angry',
  '😠': 'angry mad', '😡': 'pouting angry rage', '🤬': 'cursing angry', '🤯': 'exploding head mind blown', '😎': 'sunglasses cool',
  '🤓': 'nerd', '🧐': 'monocle', '😴': 'sleeping', '🤤': 'drooling', '😪': 'sleepy', '😵': 'dizzy', '🤢': 'nauseated sick',
  '🤮': 'vomit puke', '🤧': 'sneezing', '🤒': 'sick thermometer', '🤕': 'injured bandage', '😈': 'smiling devil', '👿': 'angry devil',
  '💀': 'skull dead', '☠️': 'skull crossbones', '👻': 'ghost', '👽': 'alien', '🤖': 'robot', '🎃': 'pumpkin halloween',
  '😺': 'cat smile', '😸': 'cat grin', '😹': 'cat joy', '😻': 'cat heart eyes', '😼': 'cat smirk', '😽': 'cat kiss',
  '🙀': 'cat scream', '😿': 'cat cry', '😾': 'cat angry', '🙈': 'see no evil', '🙉': 'hear no evil', '🙊': 'speak no evil',
  '❤️': 'red heart love', '🧡': 'orange heart', '💛': 'yellow heart', '💚': 'green heart', '💙': 'blue heart', '💜': 'purple heart',
  '🖤': 'black heart', '🤍': 'white heart', '🤎': 'brown heart', '💔': 'broken heart', '❣️': 'heart exclamation', '💕': 'two hearts',
  '💞': 'revolving hearts', '💓': 'beating heart', '💗': 'growing heart', '💖': 'sparkling heart', '💘': 'heart arrow cupid',
  '💝': 'heart ribbon', '💟': 'heart decoration', '👍': 'thumbs up like approve', '👎': 'thumbs down dislike', '👏': 'clap applause',
  '🙌': 'raised hands celebrate', '👐': 'open hands', '🤝': 'handshake deal', '🙏': 'pray please thanks', '✍️': 'writing', '💪': 'strong muscle',
  '👀': 'eyes look watch', '👁️': 'eye', '👄': 'mouth lips', '💋': 'kiss mark', '👋': 'wave hello bye', '🤞': 'crossed fingers luck',
  '✌️': 'victory peace', '🤟': 'love you', '🤘': 'rock horns', '👌': 'ok', '🤏': 'pinch', '☝️': 'point up', '👇': 'point down',
  '👆': 'point up hand', '👉': 'point right', '👈': 'point left', '👊': 'punch', '✊': 'fist', '🤲': 'palms up',
  '🎉': 'party popper celebration', '🎊': 'confetti ball celebration', '🎂': 'birthday cake', '🎈': 'balloon party', '🎁': 'gift present',
  '🔥': 'fire hot lit', '✨': 'sparkles', '⭐': 'star', '🌟': 'glowing star', '💫': 'dizzy star', '💥': 'collision boom', '💯': 'hundred perfect',
  '✅': 'check mark done', '❌': 'cross no wrong', '⚠️': 'warning', '❗': 'exclamation', '❓': 'question', '💤': 'sleep zzz',
  '💬': 'speech bubble chat', '💭': 'thought bubble', '📌': 'pin', '📎': 'paperclip', '🔒': 'lock', '🔓': 'unlock', '🔑': 'key',
  '🔔': 'bell notification', '🔕': 'bell off mute', '❤️‍🔥': 'heart on fire', '🥀': 'wilted rose', '🌹': 'rose', '🌸': 'cherry blossom flower',
  '🌺': 'hibiscus flower', '🌻': 'sunflower', '🌷': 'tulip', '🌼': 'blossom', '🌱': 'seedling plant', '🌿': 'herb leaf', '🍀': 'four leaf clover luck',
  '🍎': 'apple', '🍊': 'orange', '🍋': 'lemon', '🍉': 'watermelon', '🍓': 'strawberry', '🍇': 'grapes', '🍒': 'cherries',
  '🍑': 'peach', '🍍': 'pineapple', '🥝': 'kiwi', '🍕': 'pizza', '🍔': 'hamburger burger', '🍟': 'fries', '🌭': 'hot dog',
  '🌮': 'taco', '🍿': 'popcorn', '🍩': 'donut', '🍪': 'cookie', '🍰': 'cake', '🍫': 'chocolate', '☕': 'coffee', '🍵': 'tea',
  '⚽': 'soccer football', '🏀': 'basketball', '🏈': 'american football', '⚾': 'baseball', '🎾': 'tennis', '🏐': 'volleyball', '🎮': 'video game controller',
  '🎧': 'headphones', '🎵': 'music note', '🎶': 'musical notes', '🎤': 'microphone', '🎸': 'guitar', '🚀': 'rocket', '✈️': 'airplane',
  '🚗': 'car', '🚕': 'taxi', '🚓': 'police car', '🚑': 'ambulance', '🚒': 'fire engine', '🚲': 'bicycle', '🏠': 'house home', '🏰': 'castle',
}

const CATEGORY_RANGES = {
  Smileys: [[0x1F600,0x1F64F]],
  People: [[0x1F440,0x1F487],[0x1F4AA,0x1F64F],[0x1F9AE,0x1F9FF]],
  Animals: [[0x1F400,0x1F43F],[0x1F980,0x1F9AF]],
  Food: [[0x1F34A,0x1F37F],[0x1F950,0x1F96F],[0x1F9C0,0x1F9FF]],
  Activities: [[0x1F380,0x1F3FF],[0x1F680,0x1F6FF],[0x1F3C0,0x1F3FF]],
  Travel: [[0x1F680,0x1F6FF],[0x1F300,0x1F5FF]],
  Objects: [[0x1F4A0,0x1F4FF],[0x1F500,0x1F5FF],[0x1F9E0,0x1F9FF]],
  Symbols: [[0x2190,0x21FF],[0x2300,0x23FF],[0x25A0,0x25FF],[0x2600,0x26FF],[0x2700,0x27BF]],
}

function isEmojiCodePoint(cp) {
  try {
    return /\p{Emoji_Presentation}/u.test(String.fromCodePoint(cp))
  } catch {
    return false
  }
}

function buildEmojiList() {
  const set = new Set(Object.keys(COMMON_NAMES))
  for (const ranges of Object.values(CATEGORY_RANGES)) {
    for (const [start, end] of ranges) {
      for (let cp = start; cp <= end; cp += 1) {
        if (isEmojiCodePoint(cp)) set.add(String.fromCodePoint(cp))
      }
    }
  }
  return Array.from(set)
}

const ALL_EMOJIS = buildEmojiList()
const CATEGORY_ORDER = ['Smileys', 'People', 'Animals', 'Food', 'Activities', 'Travel', 'Objects', 'Symbols']

function detectCategory(emoji) {
  const cp = emoji.codePointAt(0)
  if (cp >= 0x1F600 && cp <= 0x1F64F) return 'Smileys'
  if ((cp >= 0x1F440 && cp <= 0x1F64F) || (cp >= 0x1F9AE && cp <= 0x1F9FF)) return 'People'
  if ((cp >= 0x1F400 && cp <= 0x1F43F) || (cp >= 0x1F980 && cp <= 0x1F9AF)) return 'Animals'
  if ((cp >= 0x1F34A && cp <= 0x1F37F) || (cp >= 0x1F950 && cp <= 0x1F96F)) return 'Food'
  if ((cp >= 0x1F380 && cp <= 0x1F3FF) || (cp >= 0x1F680 && cp <= 0x1F6FF)) return 'Activities'
  if ((cp >= 0x1F300 && cp <= 0x1F5FF)) return 'Travel'
  if ((cp >= 0x1F4A0 && cp <= 0x1F4FF) || (cp >= 0x1F500 && cp <= 0x1F5FF) || (cp >= 0x1F9E0 && cp <= 0x1F9FF)) return 'Objects'
  return 'Symbols'
}

function EmojiGrid({ query, category, onPick }) {
  const normalized = query.trim().toLowerCase().replace(/^:/, '').replace(/:$/, '')
  const items = useMemo(() => ALL_EMOJIS.filter((emoji) => {
    const name = COMMON_NAMES[emoji] || ''
    const matchesQuery = !normalized || emoji.includes(normalized) || name.includes(normalized)
    const matchesCategory = category === 'All' || detectCategory(emoji) === category || (category === 'Favorites' && ['❤️','😂','😭','👍','🔥','✨','🌸'].includes(emoji))
    return matchesQuery && matchesCategory
  }), [normalized, category])

  return (
    <div className="bloom-emoji-grid">
      {items.length ? items.map((emoji) => (
        <button key={emoji} type="button" className="bloom-emoji-cell" onClick={() => onPick(emoji)} title={COMMON_NAMES[emoji] || emoji}>
          {emoji}
        </button>
      )) : <div className="bloom-emoji-empty">No emojis found.</div>}
    </div>
  )
}

function ReactionBar({ reactions = [], userId, onToggle, getUser }) {
  const [open, setOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [openNote, setOpenNote] = useState(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerCategory, setPickerCategory] = useState('All')
  const [pickerMode, setPickerMode] = useState('emoji')
  const [pickerStyle, setPickerStyle] = useState({ top: 0, left: 0, placement: 'desktop' })
  const triggerRef = useRef(null)

  const grouped = reactions.reduce((map, reaction) => {
    const value = String(reaction.emoji || '')
    const isNote = value.startsWith(NOTE_PREFIX)
    const content = isNote ? value.slice(NOTE_PREFIX.length) : value
    const key = isNote ? `${NOTE_PREFIX}${content}` : content
    const current = map.get(key) || { value, content, isNote, count: 0, mine: false, rows: [] }
    current.count += 1
    current.mine = current.mine || reaction.user_id === userId
    current.rows.push(reaction)
    map.set(key, current)
    return map
  }, new Map())

  function placePicker() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mobile = window.innerWidth <= 760
    if (mobile) {
      setPickerStyle({ top: Math.max(8, window.innerHeight - Math.min(520, window.innerHeight * 0.7)), left: 8, placement: 'mobile' })
      return
    }
    const width = Math.min(420, window.innerWidth - 24)
    const height = Math.min(520, window.innerHeight - 24)
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12)
    const top = rect.top - height - 10 >= 12 ? rect.top - height - 10 : Math.min(rect.bottom + 10, window.innerHeight - height - 12)
    setPickerStyle({ top, left, placement: 'desktop' })
  }

  useEffect(() => {
    if (!open) return undefined
    placePicker()
    const onResize = () => placePicker()
    const onScroll = () => placePicker()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function submitNote(event) {
    event.preventDefault()
    const value = noteText.trim().replace(/\s+/g, ' ')
    if (!value) return
    // Prefix notes so they continue to use the existing reaction transport.
    onToggle(`${NOTE_PREFIX}${value}`)
    setNoteText('')
    setOpen(false)
  }

  function pickEmoji(emoji) {
    onToggle(emoji)
    setOpen(false)
    setPickerMode('emoji')
  }

  return (
    <div className="reaction-bar">
      {Array.from(grouped.entries()).map(([key, info]) => {
        if (info.isNote) {
          const first = info.rows.find(Boolean)
          const author = getUser?.(first?.user_id) || { username: 'Unknown' }
          const avatar = author.avatar_url
          return (
            <div className="note-reaction-wrap" key={key}>
              <button type="button" className={`note-reaction ${info.mine ? 'mine' : ''}`} onClick={() => setOpenNote((value) => (value === key ? null : key))} title="View note">
                <span className="note-reaction-avatar">{avatar ? <img src={avatar} alt="" /> : (author.username || '?').charAt(0).toUpperCase()}</span>
                {info.count > 1 && <span>{info.count}</span>}
              </button>
              {openNote === key && (
                <div className="note-reaction-popover" role="dialog">
                  <div className="note-reaction-popover-head">
                    <span className="note-reaction-popover-avatar">{avatar ? <img src={avatar} alt="" /> : (author.username || '?').charAt(0).toUpperCase()}</span>
                    <strong>{author.username || 'Unknown'}</strong>
                  </div>
                  <p>{info.content}</p>
                  <div className="note-reaction-popover-actions">
                    {info.mine && (
                      <button
                        type="button"
                        className="note-reaction-remove"
                        onClick={() => {
                          onToggle(info.value)
                          setOpenNote(null)
                        }}
                      >
                        Remove note
                      </button>
                    )}
                    <button type="button" className="note-reaction-dismiss" onClick={() => setOpenNote(null)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          )
        }
        return (
          <button key={key} type="button" className={`reaction-chip ${info.mine ? 'mine' : ''}`} onClick={() => onToggle(info.value)} title={`${info.count} reaction${info.count === 1 ? '' : 's'}`}>
            <span>{info.value}</span><span>{info.count}</span>
          </button>
        )
      })}

      <div className="reaction-picker-wrap">
        <button ref={triggerRef} type="button" className="reaction-add" onClick={() => { setOpen((value) => !value); setOpenNote(null); setPickerMode('emoji'); setPickerQuery(''); setPickerCategory('All') }} aria-label="Add reaction" title="Add reaction">😀</button>

        {open && createPortal(
          <>
            <button type="button" className="bloom-picker-backdrop" aria-label="Close emoji picker" onClick={() => setOpen(false)} />
            <div className={`bloom-reaction-picker ${pickerStyle.placement}`} style={{ top: pickerStyle.top, left: pickerStyle.left }} role="dialog" aria-label="Emoji and note picker">
              <div className="bloom-picker-topbar">
                <div className="bloom-picker-tabs">
                  <button type="button" className={pickerMode === 'emoji' ? 'active' : ''} onClick={() => setPickerMode('emoji')}>😀</button>
                  <button type="button" className={pickerMode === 'note' ? 'active' : ''} onClick={() => setPickerMode('note')}>Aa</button>
                </div>
                <button type="button" className="bloom-picker-close" onClick={() => setOpen(false)}>×</button>
              </div>

              {pickerMode === 'emoji' ? (
                <>
                  <input autoFocus value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} className="bloom-emoji-search" placeholder="Search emojis…" />
                  <div className="bloom-emoji-categories">
                    {['All', ...CATEGORY_ORDER].map((category) => (
                      <button type="button" key={category} className={pickerCategory === category ? 'active' : ''} onClick={() => setPickerCategory(category)}>{category === 'All' ? '★' : category.slice(0, 1)}</button>
                    ))}
                  </div>
                  <EmojiGrid query={pickerQuery} category={pickerCategory} onPick={pickEmoji} />
                </>
              ) : (
                <form className="bloom-note-panel" onSubmit={submitNote}>
                  <div className="bloom-note-title">Add a note reaction</div>
                  <p>Write a short note. It will appear as your profile picture next to the message.</p>
                  <textarea autoFocus maxLength={160} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Write something about this message…" />
                  <div className="bloom-note-footer"><span>{noteText.length}/160</span><button type="submit" disabled={!noteText.trim()}>Send note</button></div>
                </form>
              )}
            </div>
          </>, document.body
        )}
      </div>
    </div>
  )
}

export default ReactionBar
