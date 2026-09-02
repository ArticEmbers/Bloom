/* eslint-disable react-refresh/only-export-components */
const EMOJI_SHORTCODES = {
  heart: '❤️', red_heart: '❤️', love: '❤️',
  broken_heart: '💔', blue_heart: '💙', green_heart: '💚', yellow_heart: '💛', purple_heart: '💜', black_heart: '🖤', white_heart: '🤍',
  laugh: '😂', joy: '😂', rofl: '🤣', smile: '😄', grin: '😁', wink: '😉', blush: '😊',
  sob: '😭', cry: '😢', sad: '😢', angry: '😠', rage: '😡', thinking: '🤔', neutral: '😐',
  eyes: '👀', wave: '👋', clap: '👏', pray: '🙏', ok: '👌', thumbs_up: '👍', '+1': '👍', thumbsup: '👍',
  thumbs_down: '👎', fire: '🔥', star: '⭐', sparkles: '✨', tada: '🎉', party: '🥳',
  sobbing: '😭', cry_laugh: '😂', kiss: '😘', kissing_heart: '😘', hug: '🤗', cool: '😎',
  skull: '💀', skull_and_crossbones: '☠️', ghost: '👻', alien: '👽', robot: '🤖',
  cat: '🐱', cat_smile: '😸', cat_heart: '😻', dog: '🐶', fox: '🦊', rabbit: '🐰', bear: '🐻',
  rose: '🌹', flower: '🌸', cherry_blossom: '🌸', sunflower: '🌻', tulip: '🌷',
  coffee: '☕', cake: '🍰', pizza: '🍕', cookie: '🍪', ramen: '🍜', apple: '🍎',
  rocket: '🚀', check: '✅', x: '❌', warning: '⚠️', question: '❓', exclamation: '❗',
  100: '💯', spark: '💥', boom: '💥', wave_hi: '👋', eyes_two: '👀',
}

const EMOJI_ALIASES = Object.entries(EMOJI_SHORTCODES)

function replaceEmojiShortcodes(text) {
  if (!text) return text
  return String(text).replace(/(^|\s):([a-zA-Z0-9_+-]+):?(?=\s|$|[.!?,])/g, (full, prefix, key) => {
    return Object.prototype.hasOwnProperty.call(EMOJI_SHORTCODES, key)
      ? `${prefix}${EMOJI_SHORTCODES[key]}`
      : full
  })
}

function convertOutsideCodeBlocks(text) {
  if (!text) return text
  const chunks = String(text).split(/(```[\s\S]*?```)/g)
  return chunks.map((chunk, index) => index % 2 === 1 ? chunk : replaceEmojiShortcodes(chunk)).join('')
}

function getEmojiSuggestions(query, limit = 8) {
  const normalized = String(query || '').toLowerCase()
  return EMOJI_ALIASES
    .filter(([name]) => name.startsWith(normalized))
    .slice(0, limit)
    .map(([name, emoji]) => ({ name, emoji }))
}

function EmojiSuggestions({ query, onSelect }) {
  const items = getEmojiSuggestions(query)
  if (!items.length) return null

  return (
    <div className="emoji-suggestions" role="listbox" aria-label="Emoji suggestions">
      {items.map((item) => (
        <button
          key={item.name}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(item)}
        >
          <span className="emoji-suggestion-character">{item.emoji}</span>
          <span className="emoji-suggestion-name">:{item.name}:</span>
        </button>
      ))}
    </div>
  )
}

export {
  EMOJI_SHORTCODES,
  replaceEmojiShortcodes,
  convertOutsideCodeBlocks,
  getEmojiSuggestions,
  EmojiSuggestions,
}

export default EmojiSuggestions
