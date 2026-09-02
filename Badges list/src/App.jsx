import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import MediaCropper from './components/MediaCropper'
import ReactionBar from './components/ReactionBar'
import PresenceIndicator from './components/PresenceIndicator'
import MessageLightbox from './components/MessageLightbox'
import ReplyPreview from './components/ReplyPreview'
import RichMessageContent from './components/RichMessageContent'
import TextAttachment from './components/TextAttachment'
import MediaLinkPreview from './components/MediaLinkPreview'
import GlobalBadge from './components/GlobalBadge'
import SpotifyActivity, { SpotifyConnect } from './components/SpotifyActivity'
import StatusPicker from './components/StatusPicker'
import CreateServerModal from './components/CreateServerModal'
import CreateChannelModal from './components/CreateChannelModal'
import JoinServerModal from './components/JoinServerModal'
import ServerInviteModal from './components/ServerInviteModal'
import VoiceChat from './components/VoiceChat'
import VoiceSettings from './components/VoiceSettings'
import MemberList from './components/MemberList'
import EmojiSuggestions, { convertOutsideCodeBlocks, getEmojiSuggestions } from './components/EmojiShortcodes'
import './App.css'

const DEFAULT_PERMISSIONS = {
  administrator: false,
  manage_server: false,
  manage_roles: false,
  manage_channels: false,
  manage_members: false,
  delete_messages: false,
  send_messages: true,
  upload_files: true,
  send_voice_messages: true,
}

const PERMISSION_LABELS = {
  administrator: 'Administrator',
  manage_server: 'Manage server',
  manage_roles: 'Manage roles',
  manage_channels: 'Manage channels',
  manage_members: 'Manage members',
  delete_messages: 'Delete other messages',
  send_messages: 'Send messages',
  upload_files: 'Upload files',
  send_voice_messages: 'Send voice messages',
}

const APPEARANCE_STORAGE_VERSION = 3

const DEFAULT_APPEARANCE = {
  mode: 'dark',
  textColor: '',
  backgroundColor: '',
  wallpaperOpacity: 100,
  sidebarColor: '',
  panelColor: '',
  accentColor: '',
  wallpaperUrl: '',
  wallpaperEnabled: false,
  wallpaperBlur: 0,
  wallpaperDarkness: 15,
  wallpaperPosition: 'center',
  wallpaperSize: 'cover',
  appearanceVersion: APPEARANCE_STORAGE_VERSION,
}

function MentionSuggestions({ query, candidates, onSelect }) {
  const normalized = String(query || '').toLowerCase()
  const items = [
    ...(candidates?.users || []).map((user) => ({ type: 'user', id: user.id, username: user.username })),
    ...(candidates?.roles || []).map((role) => ({ type: 'role', id: role.id, name: role.name })),
  ].filter((item) => String(item.username || item.name || '').toLowerCase().startsWith(normalized)).slice(0, 8)
  if (!items.length) return null
  return (
    <div className="mention-suggestions">
      {items.map((item) => (
        <button key={`${item.type}-${item.id}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)}>
          <span className={`mention-suggestion-icon ${item.type}`}>{item.type === 'role' ? '✿' : '@'}</span>
          <span>{item.username || item.name}</span>
          <small>{item.type === 'role' ? 'Role' : 'User'}</small>
        </button>
      ))}
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  // =========================================================
  // APPEARANCE
  // =========================================================

  const [appearance, setAppearance] = useState(() => {
    try {
      const saved = localStorage.getItem('bloom-appearance')

      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          ...DEFAULT_APPEARANCE,
          ...parsed,
          appearanceVersion: APPEARANCE_STORAGE_VERSION,
          // Versions before the current glass/wallpaper behavior could leave
          // an old blur value in localStorage. Reset that legacy value once.
          wallpaperBlur:
            parsed.appearanceVersion === APPEARANCE_STORAGE_VERSION
              ? Number(parsed.wallpaperBlur || 0)
              : 0,
        }
      }
    } catch {
      // Ignore invalid local storage data.
    }

    return DEFAULT_APPEARANCE
  })

  const wallpaperInputRef = useRef(null)

  // =========================================================
  // PROFILE
  // =========================================================

  const [viewingProfile, setViewingProfile] = useState(null)
  const [viewingProfileRoles, setViewingProfileRoles] = useState([])

  const [showProfileSettings, setShowProfileSettings] =
    useState(false)

  const [settingsUsername, setSettingsUsername] = useState('')
  const [settingsBio, setSettingsBio] = useState('')

  const [settingsAvatarUrl, setSettingsAvatarUrl] = useState('')
  const [settingsBannerUrl, setSettingsBannerUrl] = useState('')
  const [settingsPresenceStatus, setSettingsPresenceStatus] = useState('online')
  const [settingsCustomStatus, setSettingsCustomStatus] = useState('')
  const [settingsAvatarDecoration, setSettingsAvatarDecoration] = useState('none')
  const [settingsProfileEffect, setSettingsProfileEffect] = useState('none')
  const [profileBadges, setProfileBadges] = useState([])
  const [adminBadgeUsername, setAdminBadgeUsername] = useState('')
  const [adminBadgeName, setAdminBadgeName] = useState('Early Supporter')
  const [grantingBadge, setGrantingBadge] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [voiceSettings, setVoiceSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bloom-voice-settings') || '{}')
    } catch {
      return {}
    }
  })
  const originalProfileMediaRef = useRef({ avatar: '', banner: '' })
  const draftProfileUploadsRef = useRef(new Set())

  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingProfileImage, setUploadingProfileImage] =
    useState(false)

  const avatarInputRef = useRef(null)
  const bannerInputRef = useRef(null)

  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropperType, setCropperType] = useState('avatar')
  const [cropperFile, setCropperFile] = useState(null)

  // =========================================================
  // SERVERS
  // =========================================================

  const [servers, setServers] = useState([])
  const [selectedServer, setSelectedServer] = useState(null)

  const [serverName, setServerName] = useState('')
  const [creatingServer, setCreatingServer] = useState(false)
  const [joiningServer, setJoiningServer] = useState(false)
  const [showServerInvite, setShowServerInvite] = useState(false)
  const [mobilePane, setMobilePane] = useState('chat')
  const [showCreateSpaceMenu, setShowCreateSpaceMenu] = useState(false)

  // =========================================================
  // CHANNELS
  // =========================================================

  const [channels, setChannels] = useState([])
  const [selectedChannel, setSelectedChannel] = useState(null)

  const [channelName, setChannelName] = useState('')
  const [creatingChannel, setCreatingChannel] =
    useState(false)

  const [showChannelMenu, setShowChannelMenu] =
    useState(false)

  const [editingChannel, setEditingChannel] =
    useState(false)

  const [editingChannelName, setEditingChannelName] =
    useState('')

  // =========================================================
  // MESSAGES
  // =========================================================

  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')

  const [editingMessageId, setEditingMessageId] =
    useState(null)

  const [editingMessage, setEditingMessage] =
    useState('')

  const [selectedFile, setSelectedFile] =
    useState(null)

  const [uploadingFile, setUploadingFile] =
    useState(false)

  const messageFileRef = useRef(null)

  const [replyingTo, setReplyingTo] = useState(null)
  const [reactions, setReactions] = useState({})
  const reactionPendingRef = useRef(new Set())
  const messagesScrollRef = useRef(null)
  const directMessagesScrollRef = useRef(null)
  const forceScrollToBottomRef = useRef(false)
  // Prevent accidental duplicate sends caused by rapid key/button events.
  const sendingMessageRef = useRef(false)
  const lastSendSignatureRef = useRef({ signature: '', at: 0 })
  const loadMessagesRequestRef = useRef(0)
  const loadDirectMessagesRequestRef = useRef(0)
  const messagesRef = useRef([])
  const directMessagesRef = useRef([])
  const [typingUsers, setTypingUsers] = useState({})
  const [onlineUsers, setOnlineUsers] = useState({})
  const typingChannelRef = useRef(null)
  const typingStopTimerRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const [lightboxImage, setLightboxImage] = useState('')
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const [emojiQuery, setEmojiQuery] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)

  // =========================================================
  // VOICE
  // =========================================================

  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef(null)
  const recordingChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

  function acceptComposerFile(file) {
    if (!file) return

    const isAllowed =
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      file.type.startsWith('audio/') ||
      file.type === 'text/plain' ||
      file.type === 'application/pdf' ||
      !!file.name?.toLowerCase().endsWith('.txt')

    if (!isAllowed) {
      return setStatus('That file type cannot be attached here.')
    }

    setSelectedFile(file)
  }

  function handleComposerPaste(event) {
    const items = Array.from(event.clipboardData?.items || [])
    const fileItem = items.find((item) => item.kind === 'file')
    if (!fileItem) return

    const file = fileItem.getAsFile()
    if (!file) return

    event.preventDefault()
    acceptComposerFile(file)
  }

  function handleComposerDrop(event) {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    if (file) acceptComposerFile(file)
  }

  // =========================================================
  // DIRECT MESSAGES
  // =========================================================

  const [directMode, setDirectMode] = useState(false)

  const [directUsers, setDirectUsers] = useState([])

  const [selectedDirectUser, setSelectedDirectUser] =
    useState(null)

  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceContext, setVoiceContext] = useState(null)

  const [directMessages, setDirectMessages] =
    useState([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    directMessagesRef.current = directMessages
  }, [directMessages])

  const [showDirectUsers, setShowDirectUsers] =
    useState(false)

  // =========================================================
  // ROLES / MEMBERS
  // =========================================================

  const [roles, setRoles] = useState([])
  const [members, setMembers] = useState([])

  const [showRoles, setShowRoles] = useState(false)
  const [showMembers, setShowMembers] =
    useState(false)

  const [newRoleName, setNewRoleName] = useState('')

  const [newRoleColor, setNewRoleColor] =
    useState('#e88aa5')

  const [newRolePermissions, setNewRolePermissions] =
    useState(DEFAULT_PERMISSIONS)

  const [editingRoleId, setEditingRoleId] =
    useState(null)

  // =========================================================
  // COMPUTED VALUES
  // =========================================================

  const currentMessages = directMode
    ? directMessages
    : messages

  const currentTitle = directMode
    ? selectedDirectUser?.username || 'Messages'
    : selectedChannel?.name ||
      selectedServer?.name ||
      'Welcome to Bloom'

  const currentPermissionSet = useMemo(() => {
    if (!selectedServer || !session) {
      return DEFAULT_PERMISSIONS
    }

    const mine = members.find(
      (member) => member.user_id === session.user.id
    )

    const roleIds = new Set(
      (mine?.member_roles || []).map(
        (item) => item.role_id
      )
    )

    const merged = {
      ...DEFAULT_PERMISSIONS,
    }

    roles
      .filter((role) => roleIds.has(role.id))
      .forEach((role) => {
        Object.entries(
          role.permissions || {}
        ).forEach(([key, value]) => {
          if (value) merged[key] = true
        })
      })

    if (merged.administrator) {
      Object.keys(merged).forEach((key) => {
        merged[key] = true
      })
    }

    return merged
  }, [
    selectedServer,
    session,
    members,
    roles,
  ])

  const can = (permission) => {
    // Server owner has server-management access.
    // Roles are NOT automatically assigned.
    if (
      selectedServer?.owner_id ===
      session?.user?.id
    ) {
      return true
    }

    return (
      currentPermissionSet.administrator ||
      currentPermissionSet[permission]
    )
  }

  // =========================================================
  // HELPERS
  // =========================================================

  function getInitial(user) {
    return (
      user?.username?.charAt(0)?.toUpperCase() ||
      '?'
    )
  }

  function formatTime(date) {
    return date
      ? new Date(date).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''
  }

  function formatDuration(seconds) {
    const minutes = String(
      Math.floor(seconds / 60)
    ).padStart(2, '0')

    const remainingSeconds = String(
      seconds % 60
    ).padStart(2, '0')

    return `${minutes}:${remainingSeconds}`
  }

  function getMediaKind(type, fileName = '') {
    const normalizedName = String(fileName || '').toLowerCase()
    const normalizedType = String(type || '').toLowerCase()
    if (normalizedType === 'text/plain' || normalizedName.endsWith('.txt')) return 'text'
    if (normalizedType.startsWith('image/')) return 'image'
    if (normalizedType.startsWith('video/')) return 'video'
    if (normalizedType.startsWith('audio/')) return 'audio'
    return 'file'
  }

  function getMentionCandidates() {
    const users = directMode
      ? [...directUsers, profile, selectedDirectUser].filter(Boolean)
      : [...(members || []).map((member) => member.profiles).filter(Boolean), profile]
    const userMap = new Map()
    users.forEach((user) => user?.username && userMap.set(String(user.username).toLowerCase(), user))
    const roleMap = new Map()
    ;(roles || []).forEach((role) => role?.name && roleMap.set(String(role.name).toLowerCase().replace(/\s+/g, '-'), role))
    return { users: [...userMap.values()], roles: [...roleMap.values()] }
  }

  function updateComposerSuggestions(value, selectionStart) {
    const before = value.slice(0, selectionStart)

    const mentionMatch = before.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/)
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1])
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
      setMentionQuery('')
    }

    const emojiMatch = before.match(/(?:^|\s):([a-zA-Z0-9_+-]*)$/)
    if (emojiMatch) {
      setEmojiQuery(emojiMatch[1])
      setEmojiOpen(true)
    } else {
      setEmojiOpen(false)
      setEmojiQuery('')
    }
  }

  function insertMention(candidate) {
    const input = document.querySelector('.message-input')
    if (!input) return
    const start = input.selectionStart ?? message.length
    const before = message.slice(0, start)
    const after = message.slice(start)
    const match = before.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/)
    if (!match) return
    const tokenStart = before.length - match[1].length - 1
    const label = candidate.type === 'role'
      ? String(candidate.name).replace(/\s+/g, '-')
      : String(candidate.username)
    const next = `${message.slice(0, tokenStart)}@${label} ${after}`
    setMessage(next)
    setMentionOpen(false)
    setMentionQuery('')
    requestAnimationFrame(() => {
      const node = document.querySelector('.message-input')
      if (!node) return
      const position = tokenStart + label.length + 2
      node.focus()
      node.setSelectionRange(position, position)
    })
  }

  function insertEmoji(item) {
    const input = document.querySelector('.message-input')
    if (!input) return
    const start = input.selectionStart ?? message.length
    const before = message.slice(0, start)
    const after = message.slice(start)
    const match = before.match(/(?:^|\s):([a-zA-Z0-9_+-]*)$/)
    if (!match) return
    const tokenStart = before.length - match[1].length - 1
    const next = `${message.slice(0, tokenStart)}${item.emoji} ${after}`
    setMessage(next)
    setEmojiOpen(false)
    setEmojiQuery('')
    requestAnimationFrame(() => {
      const node = document.querySelector('.message-input')
      if (!node) return
      const position = tokenStart + item.emoji.length + 1
      node.focus()
      node.setSelectionRange(position, position)
    })
  }

  function saveAppearance(nextAppearance) {
    const normalized = {
      ...nextAppearance,
      appearanceVersion: APPEARANCE_STORAGE_VERSION,
      wallpaperOpacity: Math.max(0, Math.min(100, Number(nextAppearance.wallpaperOpacity ?? 100))),
      wallpaperBlur: Number(nextAppearance.wallpaperBlur || 0),
    }
    setAppearance(normalized)

    localStorage.setItem(
      'bloom-appearance',
      JSON.stringify(normalized)
    )
  }

  function updateAppearance(key, value) {
    const next = {
      ...appearance,
      [key]: value,
    }

    saveAppearance(next)
  }

  function resetAppearance() {
    saveAppearance(DEFAULT_APPEARANCE)
  }

  function openMobileMenu() {
    setMobilePane(selectedServer || directMode ? 'channels' : 'servers')
  }

  function closeMobileMenu() {
    setMobilePane('chat')
  }

  function goBackToServers() {
    setMobilePane('servers')
  }

  function messageKey(messageId, direct = false) {
    return `${direct ? 'd' : 'm'}:${messageId}`
  }

  function getReactionList(messageItem, direct = false) {
    return reactions[messageKey(messageItem.id, direct)] || []
  }

  async function loadReactionsForMessages(items, direct = false) {
    const ids = (items || []).map((item) => item.id).filter(Boolean)
    if (!ids.length) {
      setReactions((current) => {
        const next = { ...current }
        return Object.keys(next).filter((key) => key.startsWith(direct ? 'd:' : 'm:')).reduce((acc, key) => {
          delete acc[key]
          return acc
        }, next)
      })
      return
    }

    let query = supabase.from('message_reactions').select('*')
    const { data, error } = direct
      ? await query.in('direct_message_id', ids)
      : await query.in('message_id', ids)

    if (error) {
      console.error(error)
      return
    }

    const grouped = {}
    ;(data || []).forEach((row) => {
      const key = messageKey(direct ? row.direct_message_id : row.message_id, direct)
      grouped[key] ||= []
      grouped[key].push(row)
    })

    setReactions((current) => {
      const next = { ...current }
      Object.keys(next).forEach((key) => {
        if (key.startsWith(direct ? 'd:' : 'm:')) delete next[key]
      })
      Object.assign(next, grouped)
      return next
    })
  }

  async function toggleReaction(messageItem, emoji, direct = false) {
    if (!session?.user?.id || !emoji || !messageItem?.id) return

    const key = `${direct ? 'd' : 'm'}:${messageItem.id}:${session.user.id}:${emoji}`
    if (reactionPendingRef.current.has(key)) return
    reactionPendingRef.current.add(key)

    const reactionKey = messageKey(messageItem.id, direct)
    const currentRows = getReactionList(messageItem, direct)
    const existing = currentRows.find(
      (row) => row.user_id === session.user.id && row.emoji === emoji
    )

    // Update the UI immediately so the reaction never flashes and disappears
    // while the database request is still in flight.
    setReactions((current) => {
      const next = { ...current }
      const rows = [...(next[reactionKey] || [])]

      if (existing) {
        next[reactionKey] = rows.filter((row) => row.id !== existing.id)
      } else {
        const optimistic = {
          id: `optimistic-${Date.now()}-${Math.random()}`,
          user_id: session.user.id,
          message_id: direct ? null : messageItem.id,
          direct_message_id: direct ? messageItem.id : null,
          emoji,
          __optimistic: true,
        }
        next[reactionKey] = [...rows, optimistic]
      }

      return next
    })

    try {
      if (existing) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('message_reactions').insert({
          user_id: session.user.id,
          message_id: direct ? null : messageItem.id,
          direct_message_id: direct ? messageItem.id : null,
          emoji,
        })

        if (error) throw error
      }

      await loadReactionsForMessages(direct ? directMessages : messages, direct)
    } catch (error) {
      // Roll back optimistic state if the database operation failed.
      await loadReactionsForMessages(direct ? directMessages : messages, direct)
      setStatus(`Error ${existing ? 'removing' : 'adding'} reaction: ${error.message}`)
    } finally {
      reactionPendingRef.current.delete(key)
    }
  }

  function handleTypingInput(event) {
    const next = event.target.value
    setMessage(next)
    updateComposerSuggestions(next, event.target.selectionStart ?? next.length)

    const channel = typingChannelRef.current
    if (!channel || !session?.user?.id) return

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: session.user.id,
        username: profile?.username || 'Someone',
        active: true,
      },
    })

    clearTimeout(typingStopTimerRef.current)
    typingStopTimerRef.current = window.setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: session.user.id,
          username: profile?.username || 'Someone',
          active: false,
        },
      })
    }, 1200)
  }

  // =========================================================
  // AUTH / PROFILE
  // =========================================================

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error(error)
    }

    setProfile(data || null)
    if (userId) {
      const { data: badgeRows } = await supabase.from('profile_global_badges').select('badge:global_badges(id,name,description,icon,priority)').eq('user_id', userId)
      setProfileBadges((badgeRows || []).map((row) => row.badge).filter(Boolean).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)))
    }

    return data || null
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(currentSession)

      if (currentSession) {
        await loadProfile(
          currentSession.user.id
        )
      }

      if (mounted) {
        setLoading(false)
      }
    }

    initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return

        setSession(newSession)

        if (event === 'PASSWORD_RECOVERY') {
          setResetPasswordValue('')
          setResetPasswordConfirm('')
          setShowPasswordReset(true)
        }

        if (newSession) {
          await loadProfile(
            newSession.user.id
          )
        } else {
          setProfile(null)
          setServers([])
          setChannels([])
          setMessages([])
          setDirectMessages([])

          setSelectedServer(null)
          setSelectedChannel(null)
          setSelectedDirectUser(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return

    const channel = supabase.channel('bloom-presence', {
      config: { presence: { key: session.user.id } },
    })

    presenceChannelRef.current = channel

    const syncPresence = () => {
      const state = channel.presenceState()
      const next = {}
      Object.values(state).forEach((entries) => {
        entries.forEach((entry) => {
          if (entry?.user_id) next[entry.user_id] = entry
        })
      })
      setOnlineUsers(next)
    }

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (profile?.presence_status !== 'invisible') {
            await channel.track({
              user_id: session.user.id,
              username: profile?.username || 'User',
              status: profile?.presence_status || 'online',
              custom_status: profile?.custom_status || '',
            })
          }
        }
      })

    return () => {
      clearTimeout(typingStopTimerRef.current)
      presenceChannelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id, profile?.username])

  useEffect(() => {
    if (!session?.user?.id) return
    if (!selectedChannel?.id && !selectedDirectUser?.id) return

    const contextKey = directMode
      ? `dm-${selectedDirectUser.id}`
      : `channel-${selectedChannel.id}`

    const channel = supabase.channel(`typing-${session.user.id}-${contextKey}`)
    typingChannelRef.current = channel

    const onTyping = ({ payload }) => {
      if (!payload?.user_id || payload.user_id === session.user.id) return

      const key = payload.user_id
      setTypingUsers((current) => {
        const next = { ...current }
        if (payload.active) {
          next[key] = {
            username: payload.username || 'Someone',
            expiresAt: Date.now() + 1800,
          }
        } else {
          delete next[key]
        }
        return next
      })

      if (payload.active) {
        window.setTimeout(() => {
          setTypingUsers((current) => {
            const item = current[key]
            if (!item || item.expiresAt > Date.now()) return current
            const next = { ...current }
            delete next[key]
            return next
          })
        }, 1900)
      }
    }

    channel.on('broadcast', { event: 'typing' }, onTyping).subscribe()

    return () => {
      typingChannelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [
    session?.user?.id,
    selectedChannel?.id,
    selectedDirectUser?.id,
    directMode,
  ])

  useEffect(() => {
    if (!session?.user?.id) return

    const channel = supabase.channel(`voice-invites-${session.user.id}`)
    channel.on('broadcast', { event: 'voice-invite' }, ({ payload }) => {
      if (!payload || payload.to !== session.user.id) return
      setVoiceContext({
        kind: 'dm',
        id: payload.call_id,
        peerId: payload.from,
        label: payload.from_username || 'Private call',
      })
      setVoiceOpen(true)
    }).subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (profile) {
      loadServers()
    }
  }, [profile])

  useEffect(() => {
    return () => {
      clearInterval(
        recordingTimerRef.current
      )

      mediaRecorderRef.current?.stream
        ?.getTracks?.()
        .forEach((track) => track.stop())
    }
  }, [])

  async function signIn() {
    if (!email || !password) {
      return setStatus(
        'Enter your email and password.'
      )
    }

    setStatus('Logging in...')

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    setStatus(
      error ? `Error: ${error.message}` : ''
    )
  }

  async function signUp() {
    if (!email || !password) {
      return setStatus(
        'Enter an email and password.'
      )
    }

    setStatus('Creating account...')

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
      })

    setStatus(
      error
        ? `Error: ${error.message}`
        : 'Account created. Check your email if confirmation is enabled.'
    )
  }

  async function signOut() {
    await supabase.auth.signOut()
    setStatus('')
  }

  async function requestPasswordReset() {
    const cleanEmail = email.trim()
    if (!cleanEmail) return setStatus('Enter your email address first.')
    setStatus('Sending password reset email...')
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin })
    if (error) return setStatus(`Error: ${error.message}`)
    setStatus('Password reset email sent. Check your inbox.')
  }

  async function changePassword() {
    if (!session?.user?.email) return
    if (!currentPassword || !newPassword || !confirmNewPassword) return setStatus('Fill in your current password and both new password fields.')
    if (newPassword.length < 6) return setStatus('Your new password must be at least 6 characters.')
    if (newPassword !== confirmNewPassword) return setStatus('The new passwords do not match.')
    setChangingPassword(true)
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword })
    if (verifyError) { setChangingPassword(false); return setStatus('Current password is incorrect.') }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) return setStatus(`Error changing password: ${error.message}`)
    setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('')
    setStatus('Password changed successfully.')
  }

  async function finishPasswordReset() {
    if (!resetPasswordValue || !resetPasswordConfirm) return setStatus('Enter and confirm your new password.')
    if (resetPasswordValue.length < 6) return setStatus('Your new password must be at least 6 characters.')
    if (resetPasswordValue !== resetPasswordConfirm) return setStatus('The new passwords do not match.')
    setResettingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: resetPasswordValue })
    setResettingPassword(false)
    if (error) return setStatus(`Error resetting password: ${error.message}`)
    setResetPasswordValue(''); setResetPasswordConfirm(''); setShowPasswordReset(false)
    setStatus('Password reset successfully. You can continue using Bloom.')
  }

  async function createProfile() {
    if (!session) return

    const cleanUsername = username.trim()

    if (!cleanUsername) {
      return setStatus(
        'Please choose a username.'
      )
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: session.user.id,
          username: cleanUsername,
        },
        {
          onConflict: 'id',
        }
      )
      .select()
      .maybeSingle()

    if (error) {
      return setStatus(
        `Error creating profile: ${error.message}`
      )
    }

    setProfile(data)
    setStatus('')
  }

  // =========================================================
  // STORAGE
  // =========================================================

  async function uploadFile(
    file,
    bucket,
    folder
  ) {
    if (!file || !session) return null

    const safeName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )

    const path =
      `${session.user.id}/` +
      `${folder}/` +
      `${Date.now()}-` +
      `${crypto.randomUUID()}-` +
      safeName

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType:
          file.type || undefined,
        upsert: false,
      })

    if (error) {
      setStatus(
        `Upload error: ${error.message}`
      )

      return null
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl
  }

  function getStorageObjectFromPublicUrl(url) {
    if (!url || typeof url !== 'string') return null
    try {
      const parsed = new URL(url)
      const marker = '/storage/v1/object/public/'
      const index = parsed.pathname.indexOf(marker)
      if (index === -1) return null
      const rest = parsed.pathname.slice(index + marker.length)
      const slash = rest.indexOf('/')
      if (slash === -1) return null
      const bucket = decodeURIComponent(rest.slice(0, slash))
      const path = decodeURIComponent(rest.slice(slash + 1))
      if (bucket !== 'profile-images') return null
      if (!path.startsWith(`${session?.user?.id || ''}/`)) return null
      return { bucket, path }
    } catch { return null }
  }

  async function deleteStoragePublicUrl(url) {
    const object = getStorageObjectFromPublicUrl(url)
    if (!object) return
    const { error } = await supabase.storage.from(object.bucket).remove([object.path])
    if (error) console.warn('Could not remove old profile image:', error.message)
  }

  async function cleanupDraftProfileUploads() {
    const urls = [...draftProfileUploadsRef.current]
    draftProfileUploadsRef.current.clear()
    await Promise.all(urls.map((url) => deleteStoragePublicUrl(url)))
  }

  // =========================================================
  // PROFILE SETTINGS
  // =========================================================

  function openProfileSettings(target = 'profile') {
    if (!profile) return

    setSettingsUsername(
      profile.username || ''
    )

    setSettingsBio(profile.bio || '')

    setSettingsAvatarUrl(
      profile.avatar_url || ''
    )

    setSettingsBannerUrl(
      profile.banner_url || ''
    )
    setSettingsPresenceStatus(profile.presence_status || 'online')
    setSettingsCustomStatus(profile.custom_status || '')
    setSettingsAvatarDecoration(profile.avatar_decoration || 'none')
    setSettingsProfileEffect(profile.profile_effect || 'none')
    originalProfileMediaRef.current = {
      avatar: profile.avatar_url || '',
      banner: profile.banner_url || '',
    }
    draftProfileUploadsRef.current = new Set()

    setShowProfileSettings(true)
    window.setTimeout(() => {
      const node = document.getElementById(`settings-section-${target}`)
      node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const MAX_PROFILE_MEDIA_BYTES =
    15 * 1024 * 1024

  function selectProfileMedia(
    event,
    type
  ) {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) return

    const allowed =
      file.type.startsWith('image/')

    if (!allowed) {
      return setStatus(
        'Please select an image or GIF.'
      )
    }

    if (
      file.size >
      MAX_PROFILE_MEDIA_BYTES
    ) {
      return setStatus(
        'That file is too large. Please choose one under 15MB.'
      )
    }

    setCropperType(type)
    setCropperFile(file)
    setCropperOpen(true)
  }

  async function handleCroppedMedia(
    result
  ) {
    const croppedFile = result?.file

    if (!croppedFile) {
      setCropperOpen(false)
      setCropperFile(null)
      return
    }

    setUploadingProfileImage(true)

    const folder =
      cropperType === 'avatar'
        ? 'avatars'
        : 'banners'

    const url = await uploadFile(
      croppedFile,
      'profile-images',
      folder
    )

    setUploadingProfileImage(false)

    if (!url) {
      return setStatus(
        'Something went wrong uploading that image. Please try again.'
      )
    }

    const previousDraftUrl = cropperType === 'avatar' ? settingsAvatarUrl : settingsBannerUrl
    const originalUrl = cropperType === 'avatar' ? originalProfileMediaRef.current.avatar : originalProfileMediaRef.current.banner
    if (previousDraftUrl && previousDraftUrl !== originalUrl) {
      draftProfileUploadsRef.current.delete(previousDraftUrl)
      await deleteStoragePublicUrl(previousDraftUrl)
    }
    draftProfileUploadsRef.current.add(url)

    if (cropperType === 'avatar') {
      setSettingsAvatarUrl(url)
    } else {
      setSettingsBannerUrl(url)
    }

    setCropperOpen(false)
    setCropperFile(null)
  }

  async function saveProfile(event) {
    event.preventDefault()

    if (!session) return

    const cleanUsername =
      settingsUsername.trim()

    if (!cleanUsername) {
      return setStatus(
        'Username cannot be empty.'
      )
    }

    setSavingProfile(true)

    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: cleanUsername,
        bio: settingsBio.trim(),
        avatar_url:
          settingsAvatarUrl || null,
        banner_url:
          settingsBannerUrl || null,
        presence_status: settingsPresenceStatus || 'online',
        custom_status: settingsCustomStatus.trim() || null,
        avatar_decoration: settingsAvatarDecoration || 'none',
        profile_effect: settingsProfileEffect || 'none',
        spotify_show: profile?.spotify_show !== false,
      })
      .eq('id', session.user.id)
      .select()
      .maybeSingle()

    setSavingProfile(false)

    if (error) {
      return setStatus(
        `Error saving profile: ${error.message}`
      )
    }

    const previousAvatar = originalProfileMediaRef.current.avatar
    const previousBanner = originalProfileMediaRef.current.banner
    if (previousAvatar && previousAvatar !== settingsAvatarUrl) await deleteStoragePublicUrl(previousAvatar)
    if (previousBanner && previousBanner !== settingsBannerUrl) await deleteStoragePublicUrl(previousBanner)
    draftProfileUploadsRef.current.clear()
    originalProfileMediaRef.current = { avatar: settingsAvatarUrl || '', banner: settingsBannerUrl || '' }

    setProfile(data)

    if (
      viewingProfile?.id ===
      session.user.id
    ) {
      setViewingProfile(data)
    }

    setShowProfileSettings(false)
    setStatus('')
  }

  async function openUserProfile(userId) {
    if (!userId) return

    let data

    if (userId === session?.user?.id) {
      data = profile
    } else {
      const result = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      data = result.data
    }

    if (!data) return

    setViewingProfile(data)
    const { data: badgeRows } = await supabase.from('profile_global_badges').select('badge:global_badges(id,name,description,icon,priority)').eq('user_id', userId)
    const badges = (badgeRows || []).map((row) => row.badge).filter(Boolean).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    setProfileBadges(badges)
    setViewingProfile((current) => ({ ...(current || data), global_badges: badges }))
    setViewingProfileRoles([])

    if (selectedServer) {
      const { data: assigned } =
        await supabase
          .from('member_roles')
          .select('roles(*)')
          .eq(
            'server_id',
            selectedServer.id
          )
          .eq('user_id', userId)

      setViewingProfileRoles(
        (assigned || [])
          .map((item) => item.roles)
          .filter(Boolean)
      )
    }
  }

  // =========================================================
  // WALLPAPER
  // =========================================================

  async function uploadWallpaper(event) {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) return

    if (!file.type.startsWith('image/')) {
      return setStatus(
        'Please choose an image or GIF wallpaper.'
      )
    }

    setUploadingProfileImage(true)

    const url = await uploadFile(
      file,
      'profile-images',
      'wallpapers'
    )

    setUploadingProfileImage(false)

    if (!url) return

    saveAppearance({
      ...appearance,
      wallpaperUrl: url,
      wallpaperEnabled: true,
    })
  }

  // =========================================================
  // SERVERS
  // =========================================================

  async function loadServers() {
    if (!session?.user?.id) return

    const { data: memberships, error: membershipError } = await supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', session.user.id)

    if (membershipError) return setStatus(`Error loading your Spaces: ${membershipError.message}`)

    const serverIds = Array.from(new Set((memberships || []).map((row) => row.server_id).filter(Boolean)))
    if (!serverIds.length) { setServers([]); return }

    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .in('id', serverIds)
      .order('created_at')

    if (error) {
      return setStatus(
        `Error loading Spaces: ${error.message}`
      )
    }

    setServers(data || [])
  }

  async function createServer(event) {
    event.preventDefault()

    if (!session) return

    const name = serverName.trim()

    if (!name) return

    const { data: server, error } =
      await supabase
        .from('servers')
        .insert({
          name,
          owner_id: session.user.id,
        })
        .select()
        .maybeSingle()

    if (error || !server) {
      return setStatus(
        `Error creating Space: ${
          error?.message || 'Unknown error'
        }`
      )
    }

    const { error: memberError } =
      await supabase
        .from('server_members')
        .upsert(
          {
            server_id: server.id,
            user_id: session.user.id,
          },
          {
            onConflict:
              'server_id,user_id',
          }
        )

    if (memberError) {
      return setStatus(
        `Space created but membership failed: ${memberError.message}`
      )
    }

    setServers((current) => [
      ...current,
      server,
    ])

    setServerName('')
    setCreatingServer(false)

    await selectServer(server)
  }

  async function joinServerByCode(code) {
    if (!session?.user?.id) return null
    const cleanCode = String(code || '').trim().toUpperCase()
    if (!cleanCode) return setStatus('Enter a Space code.')
    const { data, error } = await supabase.rpc('join_server_by_invite_code', { p_code: cleanCode })
    if (error) { setStatus(error.message || 'Unable to join this Space.'); return null }
    const joinedServer = Array.isArray(data) ? data[0] : data
    if (!joinedServer) return setStatus('That Space code is invalid.')
    await loadServers()
    setJoiningServer(false)
    setStatus('')
    await selectServer(joinedServer)
    return joinedServer
  }

  async function regenerateServerInviteCode() {
    if (!selectedServer || selectedServer.owner_id !== session?.user?.id) return null
    const { data, error } = await supabase.rpc('regenerate_server_invite_code', { p_server_id: selectedServer.id })
    if (error) { setStatus(`Error regenerating code: ${error.message}`); return null }
    const updated = Array.isArray(data) ? data[0] : data
    if (!updated) return null
    setSelectedServer(updated)
    setServers((current) => current.map((server) => server.id === updated.id ? updated : server))
    setStatus('')
    return updated
  }

  async function selectServer(server) {
    setDirectMode(false)

    setSelectedDirectUser(null)
    setSelectedServer(server)
    setSelectedChannel(null)

    setMessages([])
    setChannels([])

    setShowChannelMenu(false)
    setEditingChannel(false)

    await Promise.all([
      loadChannels(server.id),
      loadRoles(server.id),
      loadMembers(server.id),
    ])
  }

  // =========================================================
  // CHANNELS
  // =========================================================

  async function loadChannels(serverId) {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', serverId)
      .order('created_at')

    if (error) {
      return setStatus(
        `Error loading channels: ${error.message}`
      )
    }

    setChannels(data || [])
  }

  async function createChannel(event) {
    event.preventDefault()

    if (
      !selectedServer ||
      !can('manage_channels')
    ) {
      return setStatus(
        'You do not have permission to create channels.'
      )
    }

    const name = channelName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    if (!name) return

    const { data, error } =
      await supabase
        .from('channels')
        .insert({
          server_id: selectedServer.id,
          name,
          channel_type: event?.channelType || 'text',
        })
        .select()
        .maybeSingle()

    if (error || !data) {
      return setStatus(
        `Error creating channel: ${
          error?.message ||
          'Unknown error'
        }`
      )
    }

    setChannels((current) => [
      ...current,
      data,
    ])

    setSelectedChannel(data)
    setChannelName('')
    setCreatingChannel(false)
  }

  function selectChannel(channel) {
    setDirectMode(false)

    setSelectedDirectUser(null)
    setSelectedChannel(channel)

    setShowChannelMenu(false)
    setEditingChannel(false)
  }

  function startRenameChannel() {
    if (!selectedChannel) return

    setEditingChannelName(
      selectedChannel.name
    )

    setEditingChannel(true)
    setShowChannelMenu(false)
  }

  async function renameChannel(event) {
    event.preventDefault()

    if (
      !selectedChannel ||
      !can('manage_channels')
    ) {
      return setStatus(
        'You do not have permission to rename channels.'
      )
    }

    const name = editingChannelName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    if (!name) return

    const { data, error } =
      await supabase
        .from('channels')
        .update({ name })
        .eq('id', selectedChannel.id)
        .select()
        .maybeSingle()

    if (error) {
      return setStatus(
        `Error renaming channel: ${error.message}`
      )
    }

    if (!data) {
      return setStatus(
        'Channel was not updated.'
      )
    }

    setSelectedChannel(data)

    setChannels((current) =>
      current.map((item) =>
        item.id === data.id
          ? data
          : item
      )
    )

    setEditingChannel(false)
  }

  async function deleteChannel() {
    if (
      !selectedChannel ||
      !can('manage_channels')
    ) {
      return setStatus(
        'You do not have permission to delete channels.'
      )
    }

    if (
      !window.confirm(
        `Delete "${selectedChannel.name}"?`
      )
    ) {
      return
    }

    const id = selectedChannel.id

    const { error } =
      await supabase
        .from('channels')
        .delete()
        .eq('id', id)

    if (error) {
      return setStatus(
        `Error deleting channel: ${error.message}`
      )
    }

    setChannels((current) =>
      current.filter(
        (item) => item.id !== id
      )
    )

    setSelectedChannel(null)
    setMessages([])
    setShowChannelMenu(false)
  }

  // =========================================================
  // MESSAGES
  // =========================================================

  async function loadMessages(channelId) {
    if (!channelId) {
      setMessages([])
      setReactions((current) => {
        const next = { ...current }
        Object.keys(next).forEach((key) => key.startsWith('m:') && delete next[key])
        return next
      })
      return
    }

    const requestId = ++loadMessagesRequestRef.current
    const scroller = messagesScrollRef.current
    const nearBottom = scroller
      ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120
      : true

    const { data, error } =
      await supabase
        .from('messages')
        .select('*, profiles(id,username,bio,avatar_url,banner_url,presence_status,custom_status)')
        .eq('channel_id', channelId)
        .order('created_at')

    if (error) {
      return setStatus(`Error loading messages: ${error.message}`)
    }

    if (requestId !== loadMessagesRequestRef.current) return

    const base = data || []
    const replyIds = base.map((item) => item.reply_to).filter(Boolean)
    let replyMap = new Map()

    if (replyIds.length) {
      const { data: replies } = await supabase
        .from('messages')
        .select('id,content,media_url,media_name,profiles(id,username,avatar_url)')
        .in('id', replyIds)
      replyMap = new Map((replies || []).map((item) => [item.id, item]))
    }

    if (requestId !== loadMessagesRequestRef.current) return

    const enriched = base.map((item) => ({
      ...item,
      reply: item.reply_to ? replyMap.get(item.reply_to) || null : null,
    }))

    setMessages(enriched)
    await loadReactionsForMessages(enriched, false)

    if (nearBottom || forceScrollToBottomRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const node = messagesScrollRef.current
          if (node) node.scrollTop = node.scrollHeight
          forceScrollToBottomRef.current = false
        })
      })
    }
  }

  useEffect(() => {
    if (
      !selectedChannel?.id ||
      directMode
    ) {
      return
    }

    loadMessages(selectedChannel.id)

    const subscription =
      supabase
        .channel(
          `messages-${selectedChannel.id}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${selectedChannel.id}`,
          },
          () => loadMessages(selectedChannel.id)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions',
          },
          () => loadReactionsForMessages(messagesRef.current, false)
        )
        .subscribe()

    return () => {
      supabase.removeChannel(
        subscription
      )
    }
  }, [
    selectedChannel?.id,
    directMode,
  ])

  function getSendSignature({ content, file, direct, destinationId }) {
    const fileSignature = file
      ? [file.name, file.size, file.lastModified, file.type].join(':')
      : ''
    return [
      direct ? 'dm' : 'channel',
      destinationId || '',
      content || '',
      fileSignature,
      replyingTo?.id || '',
    ].join('|')
  }

  function beginMessageSend(signature) {
    if (sendingMessageRef.current) return false

    const now = Date.now()
    const previous = lastSendSignatureRef.current

    // Ignore the same submission repeated almost immediately. This covers
    // rapid Enter/button events as well as attachment sends.
    if (
      previous.signature === signature &&
      now - previous.at < 750
    ) {
      return false
    }

    sendingMessageRef.current = true
    lastSendSignatureRef.current = {
      signature,
      at: now,
    }
    return true
  }

  function finishMessageSend() {
    sendingMessageRef.current = false
  }

  async function sendMessage(event) {
    event.preventDefault()

    if (directMode) {
      return sendDirectMessage()
    }

    if (!session || !selectedChannel) {
      return
    }

    if (!can('send_messages')) {
      return setStatus(
        'You do not have permission to send messages.'
      )
    }

    const content = convertOutsideCodeBlocks(message.trim())

    if (!content && !selectedFile) {
      return
    }

    const sendSignature = getSendSignature({
      content,
      file: selectedFile,
      direct: false,
      destinationId: selectedChannel.id,
    })

    if (!beginMessageSend(sendSignature)) return

    let media_url = null
    let media_type = null

    setUploadingFile(true)

    if (selectedFile) {
      if (
        !can('upload_files') &&
        !selectedFile.type.startsWith(
          'audio/'
        )
      ) {
        setUploadingFile(false)
        finishMessageSend()

        return setStatus(
          'You do not have permission to upload files.'
        )
      }

      media_type = selectedFile.type

      media_url = await uploadFile(
        selectedFile,
        'message-files',
        'messages'
      )

      if (!media_url) {
        setUploadingFile(false)
        finishMessageSend()
        return
      }
    }

    forceScrollToBottomRef.current = true

    const { error } =
      await supabase
        .from('messages')
        .insert({
          content: content || '',
          user_id: session.user.id,
          channel_id:
            selectedChannel.id,
          media_url,
          media_type,
          media_name: selectedFile?.name || null,
          reply_to: replyingTo?.id || null,
        })

    setUploadingFile(false)

    if (error) {
      finishMessageSend()
      return setStatus(
        `Error sending message: ${error.message}`
      )
    }

    setMessage('')
    setSelectedFile(null)
    setReplyingTo(null)
    setMentionOpen(false)
    setMentionQuery('')

    if (messageFileRef.current) {
      messageFileRef.current.value = ''
    }

    await loadMessages(selectedChannel.id)
    finishMessageSend()
  }

  async function deleteMessage(msg) {
    if (!session) return

    const own =
      msg.user_id === session.user.id

    if (
      !own &&
      !can('delete_messages')
    ) {
      return setStatus(
        'You cannot delete this message.'
      )
    }

    const { error } =
      await supabase
        .from('messages')
        .delete()
        .eq('id', msg.id)

    if (error) {
      return setStatus(
        `Error deleting message: ${error.message}`
      )
    }

    setMessages((current) =>
      current.filter(
        (item) => item.id !== msg.id
      )
    )
  }

  function startEditMessage(msg) {
    setEditingMessageId(msg.id)

    setEditingMessage(
      msg.content || ''
    )
  }

  async function saveMessageEdit(msg) {
    const clean =
      editingMessage.trim()

    const { data, error } =
      await supabase
        .from('messages')
        .update({
          content: clean,
        })
        .eq('id', msg.id)
        .eq(
          'user_id',
          session.user.id
        )
        .select()
        .maybeSingle()

    if (error) {
      return setStatus(
        `Error editing message: ${error.message}`
      )
    }

    if (!data) {
      return setStatus(
        'Message could not be updated.'
      )
    }

    setMessages((current) =>
      current.map((item) =>
        item.id === msg.id
          ? {
              ...item,
              content: data.content,
            }
          : item
      )
    )

    setEditingMessageId(null)
    setEditingMessage('')
  }

  // =========================================================
  // VOICE RECORDING
  // =========================================================

  async function startRecording() {
    if (
      directMode
        ? !selectedDirectUser
        : !selectedChannel
    ) {
      return
    }

    if (
      !directMode &&
      !can('send_voice_messages')
    ) {
      return setStatus(
        'You do not have permission to send voice messages.'
      )
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
          }
        )

      const preferredType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ].find((type) =>
        MediaRecorder.isTypeSupported(type)
      )

      const recorder = preferredType
        ? new MediaRecorder(stream, {
            mimeType:
              preferredType,
          })
        : new MediaRecorder(stream)

      recordingChunksRef.current = []

      recorder.ondataavailable =
        (event) => {
          if (event.data.size > 0) {
            recordingChunksRef.current.push(
              event.data
            )
          }
        }

      recorder.onstop = () => {
        const type =
          recorder.mimeType ||
          'audio/webm'

        const extension =
          type.includes('ogg')
            ? 'ogg'
            : 'webm'

        const blob = new Blob(
          recordingChunksRef.current,
          { type }
        )

        setSelectedFile(
          new File(
            [blob],
            `voice-${Date.now()}.${extension}`,
            { type }
          )
        )

        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          )
      }

      mediaRecorderRef.current =
        recorder

      recorder.start()

      setRecording(true)
      setRecordingTime(0)

      recordingTimerRef.current =
        setInterval(() => {
          setRecordingTime(
            (value) => value + 1
          )
        }, 1000)
    } catch (error) {
      setStatus(
        `Microphone error: ${error.message}`
      )
    }
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current?.state !==
      'inactive'
    ) {
      mediaRecorderRef.current?.stop()
    }

    clearInterval(
      recordingTimerRef.current
    )

    setRecording(false)
  }

  function clearSelectedFile() {
    setSelectedFile(null)

    if (messageFileRef.current) {
      messageFileRef.current.value = ''
    }
  }

  // =========================================================
  // DIRECT MESSAGES
  // =========================================================

  async function loadDirectUsers() {
    if (!session) return

    const { data, error } =
      await supabase
        .from('profiles')
        .select('*')
        .neq(
          'id',
          session.user.id
        )
        .order('username')

    if (error) {
      return setStatus(
        `Error loading users: ${error.message}`
      )
    }

    setDirectUsers(data || [])
  }

  async function openDirectMessages() {
    setDirectMode(true)

    setSelectedServer(null)
    setSelectedChannel(null)
    setSelectedDirectUser(null)

    setMessages([])
    setDirectMessages([])

    await loadDirectUsers()

    setShowDirectUsers(true)
  }

  async function selectDirectUser(user) {
    setSelectedDirectUser(user)

    setShowDirectUsers(false)

    await loadDirectMessages(
      user.id
    )
  }

  async function loadDirectMessages(
    otherUserId
  ) {
    if (!session || !otherUserId) return

    const requestId = ++loadDirectMessagesRequestRef.current
    const scroller = directMessagesScrollRef.current
    const nearBottom = scroller
      ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120
      : true

    const { data, error } =
      await supabase
        .from('direct_messages')
        .select(
          `*,
          sender:profiles!direct_messages_sender_id_fkey(
            id, username, avatar_url, banner_url, bio,
            presence_status, custom_status
          )`
        )
        .or(
          `and(sender_id.eq.${session.user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${session.user.id})`
        )
        .order('created_at')

    if (error) {
      return setStatus(`Error loading messages: ${error.message}`)
    }

    if (requestId !== loadDirectMessagesRequestRef.current) return

    const base = data || []
    const replyIds = base.map((item) => item.reply_to).filter(Boolean)
    let replyMap = new Map()
    if (replyIds.length) {
      const { data: replies } = await supabase
        .from('direct_messages')
        .select('id,content,media_url,media_name,sender:profiles!direct_messages_sender_id_fkey(id,username,avatar_url,presence_status,custom_status)')
        .in('id', replyIds)
      replyMap = new Map((replies || []).map((item) => [item.id, item]))
    }

    if (requestId !== loadDirectMessagesRequestRef.current) return

    const enriched = base.map((item) => ({
      ...item,
      reply: item.reply_to ? replyMap.get(item.reply_to) || null : null,
    }))
    setDirectMessages(enriched)
    await loadReactionsForMessages(enriched, true)

    if (nearBottom || forceScrollToBottomRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const node = directMessagesScrollRef.current
          if (node) node.scrollTop = node.scrollHeight
          forceScrollToBottomRef.current = false
        })
      })
    }
  }

  useEffect(() => {
    if (
      !directMode ||
      !selectedDirectUser ||
      !session
    ) {
      return
    }

    const otherId =
      selectedDirectUser.id

    const channel =
      supabase
        .channel(
          `direct-${session.user.id}-${otherId}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'direct_messages',
          },
          () => loadDirectMessages(otherId)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions',
          },
          () => loadReactionsForMessages(directMessagesRef.current, true)
        )
        .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [
    directMode,
    selectedDirectUser?.id,
    session?.user?.id,
  ])

  async function sendDirectMessage() {
    if (
      !session ||
      !selectedDirectUser
    ) {
      return
    }

    const content = convertOutsideCodeBlocks(message.trim())

    if (!content && !selectedFile) {
      return
    }

    const sendSignature = getSendSignature({
      content,
      file: selectedFile,
      direct: true,
      destinationId: selectedDirectUser.id,
    })

    if (!beginMessageSend(sendSignature)) return

    let media_url = null
    let media_type = null

    setUploadingFile(true)

    if (selectedFile) {
      media_type = selectedFile.type

      media_url = await uploadFile(
        selectedFile,
        'message-files',
        'direct-messages'
      )

      if (!media_url) {
        setUploadingFile(false)
        finishMessageSend()
        return
      }
    }

    forceScrollToBottomRef.current = true

    const { error } =
      await supabase
        .from('direct_messages')
        .insert({
          sender_id:
            session.user.id,
          recipient_id:
            selectedDirectUser.id,
          content: content || '',
          media_url,
          media_type,
          media_name: selectedFile?.name || null,
          reply_to: replyingTo?.id || null,
        })

    setUploadingFile(false)

    if (error) {
      finishMessageSend()
      return setStatus(
        `Error sending message: ${error.message}`
      )
    }

    setMessage('')
    clearSelectedFile()
    setReplyingTo(null)
    setMentionOpen(false)
    setMentionQuery('')

    await loadDirectMessages(
      selectedDirectUser.id
    )
    finishMessageSend()
  }

  async function deleteDirectMessage(
    msg
  ) {
    const { error } =
      await supabase
        .from('direct_messages')
        .delete()
        .eq('id', msg.id)
        .eq(
          'sender_id',
          session.user.id
        )

    if (error) {
      return setStatus(
        `Error deleting message: ${error.message}`
      )
    }

    setDirectMessages((current) =>
      current.filter(
        (item) => item.id !== msg.id
      )
    )
  }

  function startEditDirectMessage(msg) {
    setEditingMessageId(msg.id)

    setEditingMessage(
      msg.content || ''
    )
  }

  async function saveDirectMessageEdit(
    msg
  ) {
    const { data, error } =
      await supabase
        .from('direct_messages')
        .update({
          content:
            editingMessage.trim(),
        })
        .eq('id', msg.id)
        .eq(
          'sender_id',
          session.user.id
        )
        .select()
        .maybeSingle()

    if (error || !data) {
      return setStatus(
        `Error editing message: ${
          error?.message ||
          'Message was not updated.'
        }`
      )
    }

    setDirectMessages((current) =>
      current.map((item) =>
        item.id === msg.id
          ? {
              ...item,
              content:
                data.content,
            }
          : item
      )
    )

    setEditingMessageId(null)
    setEditingMessage('')
  }

  // =========================================================
  // ROLES
  // =========================================================

  async function loadRoles(serverId) {
    const { data, error } =
      await supabase
        .from('roles')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at')

    if (error) {
      return setStatus(
        `Error loading roles: ${error.message}`
      )
    }

    setRoles(data || [])
  }

  async function loadMembers(serverId) {
    const {
      data: memberRows,
      error: memberError,
    } = await supabase
      .from('server_members')
      .select(
        'server_id,user_id'
      )
      .eq('server_id', serverId)

    if (memberError) {
      return setStatus(
        `Error loading members: ${memberError.message}`
      )
    }

    const ids = (
      memberRows || []
    ).map(
      (member) => member.user_id
    )

    if (ids.length === 0) {
      setMembers([])
      return
    }

    const [
      {
        data: profiles,
        error: profileError,
      },
      {
        data: assignments,
        error: assignmentError,
      },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id,username,avatar_url,banner_url,bio,presence_status,custom_status'
        )
        .in('id', ids),

      supabase
        .from('member_roles')
        .select(
          'user_id,role_id,roles(id,name,color,permissions)'
        )
        .eq(
          'server_id',
          serverId
        ),
    ])

    if (profileError) {
      return setStatus(
        `Error loading member profiles: ${profileError.message}`
      )
    }

    if (assignmentError) {
      return setStatus(
        `Error loading member roles: ${assignmentError.message}`
      )
    }

    const profileMap = new Map(
      (profiles || []).map(
        (item) => [item.id, item]
      )
    )

    const roleMap = new Map()

    ;(assignments || []).forEach(
      (item) => {
        const list =
          roleMap.get(item.user_id) ||
          []

        list.push(item)

        roleMap.set(
          item.user_id,
          list
        )
      }
    )

    setMembers(
      (memberRows || []).map(
        (member) => ({
          ...member,
          profiles:
            profileMap.get(
              member.user_id
            ) || null,
          member_roles:
            roleMap.get(
              member.user_id
            ) || [],
        })
      )
    )
  }

  function toggleRolePermission(key) {
    setNewRolePermissions(
      (current) => {
        const next = {
          ...current,
          [key]:
            !current[key],
        }

        if (
          key ===
            'administrator' &&
          next.administrator
        ) {
          Object.keys(next).forEach(
            (item) => {
              next[item] = true
            }
          )
        }

        return next
      }
    )
  }

  function beginEditRole(role) {
    setEditingRoleId(role.id)

    setNewRoleName(role.name)

    setNewRoleColor(
      role.color || '#e88aa5'
    )

    setNewRolePermissions({
      ...DEFAULT_PERMISSIONS,
      ...(role.permissions || {}),
    })
  }

  function resetRoleEditor() {
    setEditingRoleId(null)

    setNewRoleName('')

    setNewRoleColor('#e88aa5')

    setNewRolePermissions(
      DEFAULT_PERMISSIONS
    )
  }

  async function saveRole(event) {
    event.preventDefault()

    if (
      !selectedServer ||
      !can('manage_roles')
    ) {
      return setStatus(
        'You do not have permission to manage roles.'
      )
    }

    const name =
      newRoleName.trim()

    if (!name) {
      return setStatus(
        'Role name cannot be empty.'
      )
    }

    const payload = {
      name,
      color: newRoleColor,
      permissions:
        newRolePermissions,
    }

    let result

    if (editingRoleId) {
      result = await supabase
        .from('roles')
        .update(payload)
        .eq(
          'id',
          editingRoleId
        )
        .eq(
          'server_id',
          selectedServer.id
        )
        .select()
        .maybeSingle()
    } else {
      result = await supabase
        .from('roles')
        .insert({
          ...payload,
          server_id:
            selectedServer.id,
        })
        .select()
        .maybeSingle()
    }

    if (
      result.error ||
      !result.data
    ) {
      return setStatus(
        `Error saving role: ${
          result.error?.message ||
          'Role was not saved.'
        }`
      )
    }

    await loadRoles(
      selectedServer.id
    )

    await loadMembers(
      selectedServer.id
    )

    resetRoleEditor()
  }

  async function deleteRole(roleId) {
    if (
      !selectedServer ||
      !can('manage_roles')
    ) {
      return setStatus(
        'You do not have permission to delete roles.'
      )
    }

    if (
      !window.confirm(
        'Delete this role?'
      )
    ) {
      return
    }

    const { error } =
      await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)

    if (error) {
      return setStatus(
        `Error deleting role: ${error.message}`
      )
    }

    await loadRoles(
      selectedServer.id
    )

    await loadMembers(
      selectedServer.id
    )
  }

  // Roles are fully manual.
  // Owners can also add/remove roles from themselves.
  async function toggleMemberRole(
    member,
    roleId
  ) {
    if (
      !selectedServer ||
      !can('manage_roles')
    ) {
      return setStatus(
        'You do not have permission to assign roles.'
      )
    }

    const hasRole =
      (
        member.member_roles || []
      ).some(
        (item) =>
          item.role_id === roleId
      )

    let error

    if (hasRole) {
      ;({ error } =
        await supabase
          .from('member_roles')
          .delete()
          .eq(
            'server_id',
            selectedServer.id
          )
          .eq(
            'user_id',
            member.user_id
          )
          .eq(
            'role_id',
            roleId
          ))
    } else {
      ;({ error } =
        await supabase
          .from('member_roles')
          .insert({
            server_id:
              selectedServer.id,
            user_id:
              member.user_id,
            role_id: roleId,
          }))
    }

    if (error) {
      return setStatus(
        `Error changing role: ${error.message}`
      )
    }

    await loadMembers(
      selectedServer.id
    )
  }

  // =========================================================
  // MESSAGE MEDIA
  // =========================================================

  function MessageMedia({
    url,
    type,
    fileName,
    onImageClick,
  }) {
    if (!url) return null

    const kind =
      getMediaKind(type, fileName)

    if (kind === 'text') {
      return <TextAttachment url={url} fileName={fileName || 'text.txt'} />
    }

    if (kind === 'image') {
      return (
        <button
          type="button"
          className="message-image-button"
          onClick={() => onImageClick?.(url)}
          title="Open image"
        >
          <img className="message-image" src={url} alt="Uploaded content" />
        </button>
      )
    }

    if (kind === 'video') {
      return (
        <video
          className="message-video"
          controls
          playsInline
          src={url}
        />
      )
    }

    if (kind === 'audio') {
      return (
        <audio
          className="message-audio"
          controls
          src={url}
        />
      )
    }

    return (
      <a
        className="message-file"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        📎 Open attached file
      </a>
    )
  }

  function scrollToMessage(messageItem) {
    if (!messageItem?.id) return
    const prefix = directMode ? 'dm' : 'm'
    const target = document.getElementById(`message-${prefix}-${messageItem.id}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (target) {
      target.classList.remove('message-target-highlight')
      void target.offsetWidth
      target.classList.add('message-target-highlight')
      window.setTimeout(() => target.classList.remove('message-target-highlight'), 1200)
    }
  }

  function renderMessage(msg, index) {
    const isDM = directMode
    const previous = currentMessages[index - 1]
    const previousUserId = isDM ? previous?.sender_id : previous?.user_id
    const currentUserId = isDM ? msg.sender_id : msg.user_id
    const grouped = Boolean(previous && previousUserId === currentUserId)

    const user = isDM
      ? msg.sender || {
          id: msg.sender_id,
          username: 'Unknown',
        }
      : msg.profiles || {
          id: msg.user_id,
          username: 'Unknown',
        }

    const own = isDM
      ? msg.sender_id ===
        session.user.id
      : msg.user_id ===
        session.user.id

    const canDelete =
      own ||
      (!isDM &&
        can(
          'delete_messages'
        ))

    return (
      <div
        className={`message ${grouped ? 'message-grouped' : ''}`}
        key={msg.id}
        id={`message-${isDM ? 'dm' : 'm'}-${msg.id}`}
      >
        {grouped ? (
          <div className="message-avatar-spacer" aria-hidden="true" />
        ) : (
          <button
            className="message-avatar clickable-avatar"
            onClick={() => openUserProfile(user.id)}
          >
            <PresenceIndicator status={onlineUsers[user.id]?.status || (user.id === session.user.id ? profile?.presence_status || 'online' : 'offline')} />
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} />
            ) : (
              getInitial(user)
            )}
          </button>
        )}

        <div className="message-content">
          {!grouped && (
            <div className="message-meta">
              <button
                className="message-author"
                onClick={() => openUserProfile(user.id)}
              >
                {user.username}
              </button>
              <span className="message-time">{formatTime(msg.created_at)}</span>
            </div>
          )}

          {msg.reply && (
            <ReplyPreview
              reply={msg.reply}
              compact
              onClick={() => scrollToMessage(msg.reply)}
            />
          )}

          {editingMessageId ===
          msg.id ? (
            <div className="message-edit-area">
              <input
                autoFocus
                value={
                  editingMessage
                }
                onChange={(
                  event
                ) =>
                  setEditingMessage(
                    event.target
                      .value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    'Enter'
                  ) {
                    isDM
                      ? saveDirectMessageEdit(
                          msg
                        )
                      : saveMessageEdit(
                          msg
                        )
                  }

                  if (
                    event.key ===
                    'Escape'
                  ) {
                    setEditingMessageId(
                      null
                    )
                  }
                }}
              />

              <div className="message-edit-buttons">
                <button
                  onClick={() =>
                    isDM
                      ? saveDirectMessageEdit(
                          msg
                        )
                      : saveMessageEdit(
                          msg
                        )
                  }
                >
                  Save
                </button>

                <button
                  onClick={() =>
                    setEditingMessageId(
                      null
                    )
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {msg.content && (
                <>
                  <RichMessageContent
                    text={msg.content}
                    users={getMentionCandidates().users}
                    roles={getMentionCandidates().roles}
                    onUserClick={openUserProfile}
                  />
                  <MediaLinkPreview text={msg.content} />
                </>
              )}

              <MessageMedia
                url={
                  msg.media_url
                }
                type={msg.media_type}
                fileName={msg.media_name}
                onImageClick={setLightboxImage}
              />
              <ReactionBar
                reactions={getReactionList(msg, isDM)}
                userId={session.user.id}
                onToggle={(reaction) => toggleReaction(msg, reaction, isDM)}
                getUser={(userId) => {
                  const all = [profile, ...(members || []).map((member) => member.profiles).filter(Boolean), ...(directUsers || [])]
                  return all.find((item) => item?.id === userId) || { id: userId, username: 'Unknown' }
                }}
              />
            </>
          )}
        </div>

        <div className="message-actions">
          <button
            title="Reply"
            onClick={() => setReplyingTo({ ...msg, sender: user, profiles: user })}
          >
            ↩
          </button>

          {own && (
            <button
              title="Edit message"
              onClick={() =>
                isDM
                  ? startEditDirectMessage(
                      msg
                    )
                  : startEditMessage(
                      msg
                    )
              }
            >
              ✏
            </button>
          )}

          {canDelete && (
            <button
              className="danger-action"
              title="Delete message"
              onClick={() =>
                isDM
                  ? deleteDirectMessage(
                      msg
                    )
                  : deleteMessage(
                      msg
                    )
              }
            >
              🗑
            </button>
          )}
        </div>
      </div>
    )
  }

  // =========================================================
  // LOADING
  // =========================================================

  const appStyle = {
    '--bloom-panel-opacity': Math.max(0, Math.min(100, 100 - Number(appearance.backgroundTransparency ?? 75))) / 100,
    '--custom-text':
      appearance.textColor || undefined,

    '--custom-background':
      appearance.backgroundColor ||
        (appearance.mode === 'light' ? '#f8f3f5' : '#151014'),

    '--custom-sidebar':
      appearance.sidebarColor || undefined,

    '--custom-panel':
      appearance.panelColor || undefined,

    '--custom-accent':
      appearance.accentColor || undefined,

    // Apply the user's custom palette to the existing UI variables so
    // the color controls affect sidebars, panels, inputs and accents.
    '--sidebar-background':
      appearance.sidebarColor || undefined,

    '--sidebar-secondary':
      appearance.sidebarColor || undefined,

    '--panel-background':
      appearance.panelColor || undefined,

    '--accent':
      appearance.accentColor || undefined,

    '--accent-hover':
      appearance.accentColor || undefined,
  }


  if (loading) {
    return (
      <div
        className={`loading-page ${appearance.mode}`}
      >
        <div className="loading-flower">
          🌸
        </div>

        <p>Opening Bloom...</p>
      </div>
    )
  }

  // =========================================================
  // AUTH
  // =========================================================

  if (!session) {
    return (
      <div
        className={`auth-page ${appearance.mode}`}
      >
        <div className="auth-card">
          <div className="logo">
            <div className="logo-flower">
              🌸
            </div>

            <h1>Bloom</h1>

            <p>
              A place for
              conversations to
              bloom.
            </p>
          </div>

          <div className="input-group">
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="you@example.com"
            />
          </div>

          <div className="input-group">
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Password"
            />
          </div>

          <button
            type="button"
            className="forgot-password-button"
            onClick={requestPasswordReset}
          >
            Forgot password?
          </button>

          <button
            className="primary-button"
            onClick={signIn}
          >
            Enter Bloom
          </button>

          <button
            className="secondary-button"
            onClick={signUp}
          >
            Create an account
          </button>

          {status && (
            <p className="auth-status">
              {status}
            </p>
          )}
        </div>
      </div>
    )
  }

  // =========================================================
  // CREATE PROFILE
  // =========================================================

  if (!profile) {
    return (
      <div
        className={`profile-page ${appearance.mode}`}
      >
        <div className="profile-card">
          <div className="logo">
            <div className="logo-flower">
              🌸
            </div>

            <h1>
              Choose your name
            </h1>

            <p>
              This is how people
              will recognize you.
            </p>
          </div>

          <div className="input-group">
            <label>
              Username
            </label>

            <input
              autoFocus
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  'Enter'
                ) {
                  createProfile()
                }
              }}
              placeholder="Your name"
            />
          </div>

          <button
            className="primary-button"
            onClick={
              createProfile
            }
          >
            Continue
          </button>

          {status && (
            <p className="auth-status">
              {status}
            </p>
          )}
        </div>
      </div>
    )
  }

  // =========================================================
  // MAIN APP
  // =========================================================

  return (
    <div
      className={`app ${appearance.mode}`}
      style={appStyle}
    >
      {/* WALLPAPER */}

      {appearance.wallpaperEnabled &&
        appearance.wallpaperUrl && (
          <>
            <div
              className="app-wallpaper"
              style={{
                backgroundImage:
                  `url("${appearance.wallpaperUrl}")`,

                backgroundPosition:
                  appearance.wallpaperPosition,

                backgroundSize:
                  appearance.wallpaperSize,

                filter:
                  appearance.wallpaperBlur > 0
                    ? `blur(${appearance.wallpaperBlur}px)`
                    : "none",
                opacity:
                  Math.max(0, Math.min(100, Number(appearance.wallpaperOpacity ?? 100))) / 100,
              }}
            />

            <div
              className="app-wallpaper-overlay"
              style={{
                opacity:
                  appearance.wallpaperDarkness /
                  100,
              }}
            />
          </>
        )}

      {/* MOBILE NAVIGATION */}

      <button
        type="button"
        className={`mobile-nav-backdrop ${mobilePane !== 'chat' ? 'open' : ''}`}
        onClick={closeMobileMenu}
        aria-label="Close navigation"
      />

      {/* SERVER BAR */}

      <aside className={`server-bar ${mobilePane === 'servers' ? 'mobile-open' : ''}`}>
        <button
          type="button"
          className="mobile-close-sidebar"
          onClick={closeMobileMenu}
          aria-label="Close server navigation"
        >
          ←
        </button>
        <button
          className="app-brand"
          onClick={() => {
            setSelectedServer(null)
            setSelectedChannel(null)
            setDirectMode(false)
            setSelectedDirectUser(null)
          }}
        >
          <span>🌸</span>
          <span>Bloom</span>
        </button>

        <div className="space-title">
          YOUR SPACES
        </div>

        <div className="server-list">
          {servers.map(
            (server) => (
              <button
                key={server.id}
                className={`server-icon ${
                  selectedServer?.id ===
                    server.id &&
                  !directMode
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  selectServer(server)
                  setMobilePane('channels')
                }}
              >
                <span className="space-symbol">
                  ✿
                </span>

                <span className="space-name">
                  {server.name}
                </span>
              </button>
            )
          )}
        </div>

        <div className="server-bottom">
          <button
            className="direct-button"
            onClick={() => {
              openDirectMessages()
              setMobilePane('channels')
            }}
          >
            ✉ Messages
          </button>

          <div className={`create-space-menu ${showCreateSpaceMenu ? 'open' : ''}`}>
            <button
              className="add-server create-space-trigger"
              type="button"
              aria-expanded={showCreateSpaceMenu}
              onClick={() => setShowCreateSpaceMenu((value) => !value)}
            >
              <span>＋ Create Space</span><span className="create-space-chevron">⌄</span>
            </button>
            {showCreateSpaceMenu && (
              <div className="create-space-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowCreateSpaceMenu(false)
                    setMobilePane('chat')
                    setCreatingServer(true)
                  }}
                >
                  <span className="menu-icon">＋</span>
                  <span><strong>Create Space</strong><small>Start your own community</small></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowCreateSpaceMenu(false)
                    setMobilePane('chat')
                    setJoiningServer(true)
                  }}
                >
                  <span className="menu-icon">↗</span>
                  <span><strong>Join Space</strong><small>Enter an invite code</small></span>
                </button>
              </div>
            )}
          </div>

          <div className="server-account">
            <button
              type="button"
              className="server-account-profile"
              onClick={() => openUserProfile(profile.id)}
              title="Profile"
            >
              <span className="server-account-avatar">
                <PresenceIndicator status={profile.presence_status || 'online'} />
                {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} /> : getInitial(profile)}
              </span>
              <span className="server-account-copy">
                <strong>{profile.username}</strong>
                <small>{profile.custom_status || (profile.presence_status || 'online').replace('dnd', 'do not disturb')}</small>
              </span>
            </button>
            <button type="button" className="server-account-action" onClick={() => openProfileSettings()} title="Settings" aria-label="Settings">⚙</button>
          </div>
        </div>
      </aside>

      {/* CHANNEL SIDEBAR */}

      <aside className={`channel-sidebar ${mobilePane === 'channels' ? 'mobile-open' : ''}`}>
        <div className="server-header">
          <button
            type="button"
            className="mobile-back-button"
            onClick={goBackToServers}
            aria-label="Back to servers"
          >
            ←
          </button>
          <span>
            {directMode
              ? 'Private messages'
              : selectedServer?.name ||
                'Your garden'}
          </span>

          <button
            className="theme-button"
            onClick={() =>
              saveAppearance({
                ...appearance,
                mode:
                  appearance.mode ===
                  'dark'
                    ? 'light'
                    : 'dark',
              })
            }
          >
            {appearance.mode ===
            'dark'
              ? '☀'
              : '☾'}
          </button>
        </div>

        <div className="channel-list">
          {directMode ? (
            <>
              <div className="channel-category">
                <span>
                  CONVERSATIONS
                </span>

                <button
                  onClick={() => {
                    loadDirectUsers()
                    setShowDirectUsers(
                      true
                    )
                  }}
                >
                  ＋
                </button>
              </div>

              {selectedDirectUser && (
                <button
                  className="channel-button active"
                  onClick={() =>
                    setShowDirectUsers(
                      true
                    )
                  }
                >
                  <span className="room-flower">
                    ✦
                  </span>

                  <span>
                    {
                      selectedDirectUser.username
                    }
                  </span>
                </button>
              )}

              {!selectedDirectUser && (
                <div className="sidebar-empty">
                  <div className="sidebar-empty-icon">
                    ✉
                  </div>

                  <h3>
                    Your messages
                  </h3>

                  <p>
                    Choose someone
                    to start talking.
                  </p>
                </div>
              )}
            </>
          ) : !selectedServer ? (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon">
                🌸
              </div>

              <h3>
                Welcome to Bloom
              </h3>

              <p>
                Choose a Space or
                create your own.
              </p>
            </div>
          ) : (
            <>
              <div className="channel-category">
                <span>
                  ROOMS
                </span>

                {can(
                  'manage_channels'
                ) && (
                  <button
                    onClick={() =>
                      setCreatingChannel(
                        (value) =>
                          !value
                      )
                    }
                  >
                    ＋
                  </button>
                )}
              </div>

              {channels.map(
                (channel) => (
                  <button
                    key={
                      channel.id
                    }
                    className={`channel-button ${
                      selectedChannel?.id ===
                      channel.id
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => {
                      selectChannel(channel)
                      setMobilePane('chat')
                      if (channel.channel_type === 'voice') {
                        setVoiceContext({ kind: 'channel', id: channel.id, label: channel.name })
                        setVoiceOpen(true)
                      }
                    }}
                  >
                    <span className="room-flower">
                      {channel.channel_type === 'voice' ? '🔊' : '✿'}
                    </span>

                    <span>
                      {channel.name}
                    </span>
                  </button>
                )
              )}

            </>
          )}
        </div>


      </aside>

      {/* CHAT */}

      <main className="chat-area">
        <header className="chat-header">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={openMobileMenu}
            aria-label="Open navigation"
          >
            ☰
          </button>
          <div className="chat-title-area">
            <span className="channel-hash">
              {directMode
                ? '✦'
                : '✿'}
            </span>

            {editingChannel ? (
              <form
                className="channel-rename-form"
                onSubmit={
                  renameChannel
                }
              >
                <input
                  autoFocus
                  value={
                    editingChannelName
                  }
                  onChange={(
                    event
                  ) =>
                    setEditingChannelName(
                      event.target
                        .value
                    )
                  }
                />

                <button>
                  ✓
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEditingChannel(
                      false
                    )
                  }
                >
                  ×
                </button>
              </form>
            ) : (
              <h2>
                {currentTitle}
              </h2>
            )}
          </div>

          {directMode && selectedDirectUser && (
            <div className="channel-header-actions">
              <button
                type="button"
                className="voice-call-button"
                title="Start voice call"
                onClick={async () => {
                  const callId = `${session.user.id}:${selectedDirectUser.id}`
                  const invite = supabase.channel(`voice-invites-${selectedDirectUser.id}`)
                  await new Promise((resolve, reject) => {
                    invite.subscribe((status) => {
                      if (status === 'SUBSCRIBED') resolve()
                      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error('Could not start the voice call.'))
                    })
                  })
                  await invite.send({ type: 'broadcast', event: 'voice-invite', payload: { from: session.user.id, from_username: profile?.username || 'User', to: selectedDirectUser.id, call_id: callId } })
                  supabase.removeChannel(invite)
                  setVoiceContext({ kind: 'dm', id: callId, peerId: selectedDirectUser.id, label: selectedDirectUser.username })
                  setVoiceOpen(true)
                }}
              >☎</button>
            </div>
          )}

          {!directMode &&
            selectedServer && (
              <div className="channel-header-actions">
                {selectedServer.owner_id === session?.user?.id && (
                  <button onClick={() => setShowServerInvite(true)} title="Invite people">🔗</button>
                )}

                {can(
                  'manage_roles'
                ) && (
                  <button
                    onClick={() =>
                      setShowRoles(
                        true
                      )
                    }
                    title="Roles"
                  >
                    👑
                  </button>
                )}

                {can(
                  'manage_members'
                ) && (
                  <button
                    onClick={() =>
                      setShowMembers(
                        true
                      )
                    }
                    title="Members"
                  >
                    👥
                  </button>
                )}

                {selectedChannel &&
                  can(
                    'manage_channels'
                  ) && (
                    <div className="channel-settings-wrapper">
                      <button
                        onClick={() =>
                          setShowChannelMenu(
                            (value) =>
                              !value
                          )
                        }
                        title="Channel settings"
                      >
                        ⚙
                      </button>

                      {showChannelMenu && (
                        <div className="channel-settings-menu">
                          <button
                            onClick={
                              startRenameChannel
                            }
                          >
                            ✏ Rename
                          </button>

                          <button
                            className="danger"
                            onClick={
                              deleteChannel
                            }
                          >
                            🗑 Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}
        </header>

        <div ref={directMode ? directMessagesScrollRef : messagesScrollRef} className="messages">
          {(!directMode &&
            !selectedChannel) ||
          (directMode &&
            !selectedDirectUser) ? (
            <div className="empty-chat">
              <div className="empty-chat-icon">
                🌸
              </div>

              <h2>
                {directMode
                  ? 'Your private messages'
                  : selectedServer
                    ? 'Choose a Room'
                    : 'Welcome to Bloom'}
              </h2>

              <p>
                {directMode
                  ? 'Choose someone to start a conversation.'
                  : selectedServer
                    ? 'Select a Room to start talking.'
                    : 'Create or select a Space to begin.'}
              </p>
            </div>
          ) : currentMessages.length ===
            0 ? (
            <div className="empty-chat">
              <div className="empty-chat-icon">
                ✿
              </div>

              <h2>
                Start the
                conversation
              </h2>

              <p>
                This place is
                waiting for its
                first message.
              </p>
            </div>
          ) : (
            currentMessages.map((item, index) => renderMessage(item, index))
          )}
        </div>

        {Object.keys(typingUsers).length > 0 && (
          <div className="typing-indicator">
            {Object.values(typingUsers).length === 1
              ? `${Object.values(typingUsers)[0].username} is typing…`
              : `${Object.values(typingUsers).map((item) => item.username).join(', ')} are typing…`}
          </div>
        )}

        {(selectedChannel ||
          selectedDirectUser) && (
          <form
            className="message-form"
            onSubmit={sendMessage}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleComposerDrop}
          >
            {replyingTo && (
              <ReplyPreview
                reply={replyingTo}
                onCancel={() => setReplyingTo(null)}
              />
            )}
            {selectedFile && (
              <div className="selected-file-preview">
                <span>
                  {selectedFile.type.startsWith(
                    'audio/'
                  )
                    ? '🎙'
                    : selectedFile.type.startsWith(
                        'image/'
                      )
                      ? '🖼'
                      : selectedFile.type.startsWith(
                          'video/'
                        )
                        ? '🎬'
                        : '📎'}{' '}
                  {selectedFile.name}
                </span>

                <button
                  type="button"
                  onClick={
                    clearSelectedFile
                  }
                >
                  ×
                </button>
              </div>
            )}

            <input
              ref={messageFileRef}
              type="file"
              style={{
                display: 'none',
              }}
              onChange={(event) =>
                setSelectedFile(
                  event.target
                    .files?.[0] ||
                    null
                )
              }
            />

            <button
              type="button"
              className="attachment-button"
              title="Attach file"
              onClick={() =>
                messageFileRef.current?.click()
              }
              disabled={
                uploadingFile
              }
            >
              ＋
            </button>

            <textarea
              className="message-input"
              value={message}
              rows={1}
              onPaste={handleComposerPaste}
              onChange={(event) => {
                handleTypingInput(event)
                updateComposerSuggestions(event.target.value, event.target.selectionStart ?? event.target.value.length)
              }}
              onKeyDown={(event) => {
                // Enter sends; Shift + Enter inserts a newline.
                // Use the existing submit handler directly instead of
                // requestSubmit(), which can cause an extra render/focus
                // cycle in the composer and produce a visible jump.
                if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                  if (emojiOpen) {
                    const first = getEmojiSuggestions(emojiQuery, 1)[0]
                    if (first) {
                      event.preventDefault()
                      insertEmoji(first)
                      return
                    }
                  }

                  if (mentionOpen) {
                    const candidates = getMentionCandidates()
                    const query = mentionQuery.toLowerCase()
                    const filtered = [
                      ...candidates.users.map((item) => ({ type: 'user', username: item.username, id: item.id })),
                      ...candidates.roles.map((item) => ({ type: 'role', name: item.name, id: item.id })),
                    ].filter((item) => String(item.username || item.name || '').toLowerCase().startsWith(query)).slice(0, 8)
                    if (filtered[0]) {
                      event.preventDefault()
                      insertMention(filtered[0])
                      return
                    }
                  }

                  event.preventDefault()
                  void sendMessage(event)
                  return
                }

                if ((mentionOpen || emojiOpen) && event.key === 'Escape') {
                  setMentionOpen(false)
                  setEmojiOpen(false)
                  return
                }
              }}
              placeholder={
                directMode
                  ? `Message ${
                      selectedDirectUser?.username ||
                      ''
                    }...`
                  : `Write in ${
                      selectedChannel?.name ||
                      ''
                    }...`
              }
            />

            {mentionOpen && (
              <MentionSuggestions
                query={mentionQuery}
                candidates={getMentionCandidates()}
                onSelect={insertMention}
              />
            )}

            {emojiOpen && (
              <EmojiSuggestions
                query={emojiQuery}
                onSelect={insertEmoji}
              />
            )}

            <button
              type="button"
              className={
                recording
                  ? 'voice-button recording'
                  : 'voice-button'
              }
              onClick={
                recording
                  ? stopRecording
                  : startRecording
              }
              title={
                recording
                  ? 'Stop recording'
                  : 'Record voice message'
              }
            >
              {recording
                ? `■ ${formatDuration(
                    recordingTime
                  )}`
                : '🎙'}
            </button>

            <button
              type="submit"
              className="send-button"
              disabled={
                uploadingFile
              }
            >
              {uploadingFile
                ? 'Uploading...'
                : 'Send ✿'}
            </button>
          </form>
        )}
      </main>

      {voiceOpen && voiceContext && (
        <VoiceChat
          open={voiceOpen}
          session={session}
          profile={profile}
          context={voiceContext}
          inputDeviceId={voiceSettings.inputDeviceId || ''}
          outputDeviceId={voiceSettings.outputDeviceId || ''}
          noiseMode={voiceSettings.noiseMode || 'rnnoise'}
          noiseSuppressionLevel={voiceSettings.noiseSuppressionLevel ?? 85}
          onClose={() => { setVoiceOpen(false); setVoiceContext(null) }}
        />
      )}

      {lightboxImage && (
        <MessageLightbox
          src={lightboxImage}
          onClose={() => setLightboxImage('')}
        />
      )}

      {/* STATUS */}

      {status && (
        <div className="status">
          {status}
        </div>
      )}

      {/* DIRECT USERS */}

      {showDirectUsers && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowDirectUsers(
              false
            )
          }
        >
          <div
            className="roles-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="settings-header">
              <div>
                <span className="settings-kicker">
                  PRIVATE MESSAGES
                </span>

                <h2>
                  Choose a person
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowDirectUsers(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="roles-list">
              {directUsers.map(
                (user) => (
                  <button
                    key={user.id}
                    className="role-item"
                    onClick={() =>
                      selectDirectUser(
                        user
                      )
                    }
                  >
                    <div className="role-info">
                      <span className="avatar">
                        {user.avatar_url ? (
                          <img
                            src={
                              user.avatar_url
                            }
                            alt=""
                          />
                        ) : (
                          getInitial(user)
                        )}
                      </span>

                      <span>
                        {
                          user.username
                        }
                      </span>
                    </div>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW PROFILE */}

      {viewingProfile && (
        <div
          className="modal-overlay"
          onClick={() =>
            setViewingProfile(
              null
            )
          }
        >
          <div
            className="profile-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="modal-close"
              onClick={() =>
                setViewingProfile(
                  null
                )
              }
            >
              ×
            </button>

            <div
              className="profile-banner"
              style={
                viewingProfile.banner_url
                  ? {
                      backgroundImage:
                        `url("${viewingProfile.banner_url}")`,
                    }
                  : {}
              }
            />

            <div className="profile-modal-content">
              <div className="profile-avatar-large profile-avatar-with-status">
                <div className={`profile-avatar-art decoration-${viewingProfile.avatar_decoration || 'none'} effect-${viewingProfile.profile_effect || 'none'}`}>
                  {viewingProfile.avatar_url ? (
                    <img
                      src={
                        viewingProfile.avatar_url
                      }
                      alt={
                        viewingProfile.username
                      }
                    />
                  ) : (
                    getInitial(
                      viewingProfile
                    )
                  )}
                </div>
                <PresenceIndicator
                  status={onlineUsers[viewingProfile.id]?.status || viewingProfile.presence_status || 'offline'}
                  size="profile"
                />
              </div>

              <div className={`profile-identity-line`}>
                <h2>{viewingProfile.username}</h2>
                <div className="profile-global-badges">
                  {profileBadges.map((badge) => <GlobalBadge key={badge.id} badge={badge} />)}
                </div>
              </div>

              <SpotifyActivity profile={viewingProfile} editable={false} />

              <div className="profile-status-line">
                <PresenceIndicator status={onlineUsers[viewingProfile.id]?.status || viewingProfile.presence_status || 'offline'} />
                <span>{viewingProfile.custom_status || (viewingProfile.presence_status || 'offline').replace('dnd', 'Do Not Disturb')}</span>
              </div>

              {viewingProfileRoles.length >
                0 && (
                <div className="profile-section">
                  <h4>
                    ROLES
                  </h4>

                  <div className="profile-role-list">
                    {viewingProfileRoles.map(
                      (role) => (
                        <span
                          key={role.id}
                          className="profile-role-badge"
                          style={{
                            color:
                              role.color,
                            borderColor:
                              role.color,
                            backgroundColor:
                              `${role.color}18`,
                          }}
                        >
                          {role.name}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="profile-section">
                <h4>
                  ABOUT
                </h4>

                <p>
                  {viewingProfile.bio ||
                    'This person has not written a bio yet.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE SETTINGS */}

      {showProfileSettings && (
        <div
          className="modal-overlay"
          onClick={async () => {
            await cleanupDraftProfileUploads()
            setShowProfileSettings(false)
          }}
        >
          <div
            className="settings-modal unified-settings-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="settings-header">
              <div>
                <span className="settings-kicker">
                  PERSONAL SPACE
                </span>

                <h2>
                  Profile Settings
                </h2>
                <p className="settings-subtitle">Update your profile without leaving the conversation.</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={async () => {
                  await cleanupDraftProfileUploads()
                  setShowProfileSettings(false)
                }}
              >
                ×
              </button>
            </div>

            <nav className="unified-settings-nav" aria-label="Settings sections">
              <button type="button" onClick={() => document.getElementById('settings-section-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>👤 <span>Profile</span></button>
              <button type="button" onClick={() => document.getElementById('settings-section-appearance')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>🎨 <span>Appearance</span></button>
              <button type="button" onClick={() => document.getElementById('settings-section-voice')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>🎙 <span>Voice & Audio</span></button>
              <button type="button" onClick={() => document.getElementById('settings-section-security')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>🔒 <span>Security</span></button>
            </nav>

            <form
              onSubmit={
                saveProfile
              }
            >
              <section id="settings-section-profile" className="unified-settings-section">
                <div className="unified-settings-section-heading">
                  <div><span className="settings-kicker">PROFILE</span><h3>Personal information</h3><p>Change how people see you on Bloom.</p></div>
                </div>
              <div className="profile-preview">
                <input
                  ref={
                    avatarInputRef
                  }
                  type="file"
                  accept="image/*,.gif"
                  hidden
                  onChange={(
                    event
                  ) =>
                    selectProfileMedia(
                      event,
                      'avatar'
                    )
                  }
                />

                <input
                  ref={
                    bannerInputRef
                  }
                  type="file"
                  accept="image/*,.gif"
                  hidden
                  onChange={(
                    event
                  ) =>
                    selectProfileMedia(
                      event,
                      'banner'
                    )
                  }
                />

                <button
                  type="button"
                  className="preview-banner clickable-media"
                  style={
                    settingsBannerUrl
                      ? {
                          backgroundImage:
                            `url("${settingsBannerUrl}")`,
                        }
                      : {}
                  }
                  onClick={() =>
                    bannerInputRef.current?.click()
                  }
                  title="Change banner"
                  aria-label="Change banner"
                >
                  <span className="media-change-hint">
                    <span className="media-change-icon">
                      🖼
                    </span>
                    Change banner
                  </span>
                </button>

                <button
                  type="button"
                  className="preview-avatar clickable-media"
                  onClick={() =>
                    avatarInputRef.current?.click()
                  }
                  title="Change profile picture"
                  aria-label="Change profile picture"
                >
                  {settingsAvatarUrl ? (
                    <img
                      src={
                        settingsAvatarUrl
                      }
                      alt="Preview"
                    />
                  ) : (
                    settingsUsername
                      .charAt(0)
                      .toUpperCase() ||
                    '?'
                  )}

                  <span className="media-change-hint avatar-hint">
                    Change
                  </span>
                </button>

                <div className="preview-name">
                  {settingsUsername ||
                    'Username'}
                </div>
              </div>

              <div className="input-group">
                <label>
                  Username
                </label>

                <input
                  value={
                    settingsUsername
                  }
                  maxLength={32}
                  onChange={(
                    event
                  ) =>
                    setSettingsUsername(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <div className="input-group">
                <label>
                  Bio
                </label>

                <textarea
                  className="profile-textarea"
                  value={
                    settingsBio
                  }
                  maxLength={300}
                  onChange={(
                    event
                  ) =>
                    setSettingsBio(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <div className="input-group profile-status-settings">
                <label>Status</label>
                <StatusPicker
                  value={settingsPresenceStatus}
                  onChange={setSettingsPresenceStatus}
                />
              </div>

              <div className="input-group">
                <label>Custom status</label>
                <input
                  value={settingsCustomStatus}
                  maxLength={128}
                  onChange={(event) => setSettingsCustomStatus(event.target.value)}
                  placeholder="What are you up to?"
                />
              </div>

              <div className="profile-feature-card">
                <div><span className="settings-kicker">PROFILE STYLE</span><h3>Decoration & effect</h3><p>Choose a free avatar decoration and a subtle profile effect.</p></div>
                <div className="profile-style-group">
                  <div className="profile-style-label">Avatar decoration</div>
                  <div className="profile-style-grid">
                    {[
                      ['none', '○', 'None'],
                      ['sparkle', '✦', 'Sparkles'],
                      ['flower', '🌸', 'Flower'],
                      ['halo', '◌', 'Halo'],
                      ['moon', '☾', 'Moon'],
                      ['hearts', '♥', 'Hearts'],
                      ['crown', '♛', 'Crown'],
                      ['orbit', '◉', 'Orbit'],
                      ['rainbow', '🌈', 'Rainbow'],
                      ['crystal', '◆', 'Crystal'],
                    ].map(([value, icon, label]) => (
                      <button key={value} type="button" className={settingsAvatarDecoration === value ? 'active' : ''} onClick={() => setSettingsAvatarDecoration(value)}>
                        <span className={`style-preview decoration-preview-${value}`}>{icon}</span><small>{label}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="profile-style-group">
                  <div className="profile-style-label">Profile effect</div>
                  <div className="profile-style-grid">
                    {[
                      ['none', '✧', 'None'],
                      ['glow', '✦', 'Glow'],
                      ['float', '↕', 'Float'],
                      ['stars', '✦', 'Stars'],
                      ['sparkles', '✦', 'Sparkles'],
                      ['heart', '♥', 'Hearts'],
                      ['shimmer', '◈', 'Shimmer'],
                      ['pulse', '◉', 'Pulse'],
                      ['fireflies', '•', 'Fireflies'],
                      ['orbit', '◎', 'Orbit'],
                    ].map(([value, icon, label]) => (
                      <button key={value} type="button" className={settingsProfileEffect === value ? 'active' : ''} onClick={() => setSettingsProfileEffect(value)}>
                        <span className={`style-preview effect-preview-${value}`}>{icon}</span><small>{label}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <SpotifyConnect profile={profile} onProfileUpdated={setProfile} />
              <SpotifyActivity profile={profile} editable={true} onProfileUpdated={setProfile} />

              </section>

              <section id="settings-section-security" className="unified-settings-section">
              <section className="password-settings-card">
                <div className="password-settings-heading">
                  <div><span className="settings-kicker">SECURITY</span><h3>Change password</h3><p>Update your password without leaving Bloom.</p></div>
                </div>
                <div className="password-settings-grid">
                  <div className="input-group"><label>Current password</label><input type="password" value={currentPassword} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" /></div>
                  <div className="input-group"><label>New password</label><input type="password" value={newPassword} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" /></div>
                  <div className="input-group"><label>Confirm new password</label><input type="password" value={confirmNewPassword} autoComplete="new-password" onChange={(event) => setConfirmNewPassword(event.target.value)} placeholder="Repeat new password" /></div>
                </div>
                <button type="button" className="small-button" onClick={changePassword} disabled={changingPassword}>{changingPassword ? 'Changing password...' : 'Change password'}</button>
              </section>

              </section>

              <section id="settings-section-voice" className="unified-settings-section">
                <div className="unified-settings-section-heading">
                  <div><span className="settings-kicker">VOICE & AUDIO</span><h3>Voice settings</h3><p>Choose your microphone, speakers and monitoring options.</p></div>
                </div>
                <VoiceSettings
                  value={voiceSettings}
                  onChange={setVoiceSettings}
                />
              </section>


      <section id="settings-section-appearance" className="unified-settings-section">
        <div className="unified-settings-section-heading">
          <div><span className="settings-kicker">PERSONALIZATION</span><h3>Appearance</h3><p>Theme, colors, wallpaper and transparency.</p></div>
        </div>
        <div className="appearance-settings">

              <div className="appearance-section">
                <h3>
                  Theme
                </h3>

                <div className="theme-choice-buttons">
                  <button
                    type="button"
                    className={
                      appearance.mode ===
                      'dark'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      updateAppearance(
                        'mode',
                        'dark'
                      )
                    }
                  >
                    🌙 Dark
                  </button>

                  <button
                    type="button"
                    className={
                      appearance.mode ===
                      'light'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      updateAppearance(
                        'mode',
                        'light'
                      )
                    }
                  >
                    ☀ Light
                  </button>
                </div>
              </div>

              <div className="appearance-section">
                <h3>
                  Colors
                </h3>

                <div className="color-settings-grid">
                  <label className="color-setting">
                    <span>
                      Text
                    </span>

                    <input
                      type="color"
                      value={
                        appearance.textColor ||
                        '#ffffff'
                      }
                      onChange={(
                        event
                      ) =>
                        updateAppearance(
                          'textColor',
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <label className="color-setting">
                    <span>
                      Background
                    </span>

                    <input
                      type="color"
                      value={
                        appearance.backgroundColor ||
                        '#202225'
                      }
                      onChange={(
                        event
                      ) =>
                        updateAppearance(
                          'backgroundColor',
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <label className="color-setting">
                    <span>
                      Sidebar
                    </span>

                    <input
                      type="color"
                      value={
                        appearance.sidebarColor ||
                        '#17181b'
                      }
                      onChange={(
                        event
                      ) =>
                        updateAppearance(
                          'sidebarColor',
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <label className="color-setting">
                    <span>
                      Panels
                    </span>

                    <input
                      type="color"
                      value={
                        appearance.panelColor ||
                        '#2b2d31'
                      }
                      onChange={(
                        event
                      ) =>
                        updateAppearance(
                          'panelColor',
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <label className="color-setting">
                    <span>
                      Accent
                    </span>

                    <input
                      type="color"
                      value={
                        appearance.accentColor ||
                        '#e88aa5'
                      }
                      onChange={(
                        event
                      ) =>
                        updateAppearance(
                          'accentColor',
                          event.target
                            .value
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="appearance-section">
                <h3>
                  Wallpaper
                </h3>

                <input
                  ref={
                    wallpaperInputRef
                  }
                  type="file"
                  accept="image/*,.gif"
                  hidden
                  onChange={
                    uploadWallpaper
                  }
                />

                <div
                  className="wallpaper-preview"
                  style={
                    appearance.wallpaperUrl
                      ? {
                          backgroundImage:
                            `url("${appearance.wallpaperUrl}")`,
                        }
                      : {}
                  }
                >
                  {!appearance.wallpaperUrl && (
                    <span>
                      No wallpaper
                    </span>
                  )}
                </div>

                <div className="wallpaper-buttons">
                  <button
                    className="small-button"
                    type="button"
                    onClick={() =>
                      wallpaperInputRef.current?.click()
                    }
                  >
                    🖼 Change wallpaper
                  </button>

                  <button
                    className="small-button"
                    type="button"
                    onClick={() =>
                      updateAppearance(
                        'wallpaperEnabled',
                        !appearance.wallpaperEnabled
                      )
                    }
                    disabled={
                      !appearance.wallpaperUrl
                    }
                  >
                    {appearance.wallpaperEnabled
                      ? 'Hide wallpaper'
                      : 'Show wallpaper'}
                  </button>

                  <button
                    className="small-button danger"
                    type="button"
                    onClick={() =>
                      saveAppearance({
                        ...appearance,
                        wallpaperUrl:
                          '',
                        wallpaperEnabled:
                          false,
                      })
                    }
                    disabled={
                      !appearance.wallpaperUrl
                    }
                  >
                    Remove
                  </button>
                </div>

                <label className="range-setting appearance-wallpaper-opacity">
                  <span>
                    Wallpaper visibility {appearance.wallpaperOpacity}%
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={appearance.wallpaperOpacity}
                    onChange={(event) =>
                      updateAppearance(
                        'wallpaperOpacity',
                        Number(event.target.value)
                      )
                    }
                  />
                </label>

                <label className="range-setting appearance-background-transparency">
                  <span>
                    App background transparency {appearance.backgroundTransparency ?? 75}%
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={appearance.backgroundTransparency ?? 75}
                    onChange={(event) =>
                      updateAppearance(
                        'backgroundTransparency',
                        Number(event.target.value)
                      )
                    }
                  />
                </label>

                <label className="range-setting">
                  <span>
                    Darkness{' '}
                    {
                      appearance.wallpaperDarkness
                    }
                    %
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={
                      appearance.wallpaperDarkness
                    }
                    onChange={(
                      event
                    ) =>
                      updateAppearance(
                        'wallpaperDarkness',
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                  />
                </label>

                <label className="range-setting">
                  <span>
                    Blur{' '}
                    {
                      appearance.wallpaperBlur
                    }
                    px
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={
                      appearance.wallpaperBlur
                    }
                    onChange={(
                      event
                    ) =>
                      updateAppearance(
                        'wallpaperBlur',
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                  />
                </label>

                <div className="appearance-select-row">
                  <label>
                    Position

                    <select
                      value={
                        appearance.wallpaperPosition
                      }
                      onChange={(
                        event
                      ) =>
                        updateAppearance(
                          'wallpaperPosition',
                          event.target
                            .value
                        )
                      }
                    >
                      <option value="center">
                        Center
                      </option>

                      <option value="top">
                        Top
                      </option>

                      <option value="bottom">
                        Bottom
                      </option>

                      <option value="left">
                        Left
                      </option>

                      <option value="right">
                        Right
                      </option>
                    </select>
                  </label>

                  <label>
                    Size

                    <select
                      value={
                        appearance.wallpaperSize
                      }
                      onChange={(
                        event
                      ) =>
                        updateAppearance(
                          'wallpaperSize',
                          event.target
                            .value
                        )
                      }
                    >
                      <option value="cover">
                        Cover
                      </option>

                      <option value="contain">
                        Contain
                      </option>

                      <option value="auto">
                        Original
                      </option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div className="settings-actions appearance-reset-actions">
              <button type="button" className="small-button danger" onClick={resetAppearance}>Reset appearance</button>
            </div>
      </section>



              {(import.meta.env.VITE_BLOOM_OWNER_ID && session?.user?.id === import.meta.env.VITE_BLOOM_OWNER_ID) && (
                <section className="unified-settings-section owner-badge-section">
                  <div className="unified-settings-section-heading"><div><span className="settings-kicker">OWNER</span><h3>Global badges</h3><p>Grant account-wide badges that appear across Bloom.</p></div></div>
                  <div className="owner-badge-form">
                    <input value={adminBadgeUsername} onChange={(event) => setAdminBadgeUsername(event.target.value)} placeholder="Username" />
                    <select value={adminBadgeName} onChange={(event) => setAdminBadgeName(event.target.value)}>
                      {['Owner','Early Supporter','Developer','Contributor','Founding Member','Bug Hunter','Artist','VIP','Community Helper','Friend of Bloom'].map((name) => <option key={name}>{name}</option>)}
                    </select>
                    <button type="button" className="small-button primary" disabled={grantingBadge} onClick={async () => {
                      const username = adminBadgeUsername.trim(); if (!username) return; setGrantingBadge(true);
                      const { data: target } = await supabase.from('profiles').select('id,username').eq('username', username).maybeSingle();
                      if (!target) { setStatus('User not found.'); setGrantingBadge(false); return }
                      const { error } = await supabase.rpc('grant_global_badge', { p_user_id: target.id, p_badge_name: adminBadgeName });
                      setGrantingBadge(false); if (error) return setStatus(error.message); setStatus(`Granted ${adminBadgeName} to ${target.username}.`);
                    }}>{grantingBadge ? 'Granting…' : 'Grant badge'}</button>
                  </div>
                </section>
              )}

              <div className="settings-actions unified-settings-actions">
                <button type="button" className="small-button danger" onClick={signOut}>Log out</button>
                <button type="submit" className="small-button primary" disabled={savingProfile || uploadingProfileImage}>
                  {uploadingProfileImage ? 'Uploading...' : savingProfile ? 'Saving...' : 'Save profile changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET */}
      {showPasswordReset && (
        <div className="modal-overlay password-reset-overlay" onClick={() => setShowPasswordReset(false)}>
          <div className="settings-modal password-reset-modal" onClick={(event) => event.stopPropagation()}>
            <div className="settings-header">
              <div><span className="settings-kicker">ACCOUNT RECOVERY</span><h2>Choose a new password</h2><p className="settings-subtitle">Set a new password for your Bloom account.</p></div>
              <button type="button" className="modal-close" onClick={() => setShowPasswordReset(false)}>×</button>
            </div>
            <div className="input-group"><label>New password</label><input type="password" value={resetPasswordValue} autoComplete="new-password" onChange={(event) => setResetPasswordValue(event.target.value)} placeholder="At least 6 characters" /></div>
            <div className="input-group"><label>Confirm password</label><input type="password" value={resetPasswordConfirm} autoComplete="new-password" onChange={(event) => setResetPasswordConfirm(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') finishPasswordReset() }} placeholder="Repeat your new password" /></div>
            <div className="settings-actions"><button type="button" className="small-button" onClick={() => setShowPasswordReset(false)}>Cancel</button><button type="button" className="small-button primary" disabled={resettingPassword} onClick={finishPasswordReset}>{resettingPassword ? 'Saving...' : 'Set new password'}</button></div>
          </div>
        </div>
      )}

      {/* ROLES */}

      {showRoles &&
        selectedServer && (
          <div
            className="modal-overlay"
            onClick={() =>
              setShowRoles(
                false
              )
            }
          >
            <div
              className="roles-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="settings-header">
                <div>
                  <span className="settings-kicker">
                    SERVER MANAGEMENT
                  </span>

                  <h2>
                    Roles &
                    permissions
                  </h2>
                </div>

                <button
                  className="modal-close"
                  onClick={() =>
                    setShowRoles(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <form
                className="role-create-form"
                onSubmit={
                  saveRole
                }
              >
                <input
                  placeholder="Role name"
                  value={
                    newRoleName
                  }
                  onChange={(
                    event
                  ) =>
                    setNewRoleName(
                      event.target
                        .value
                    )
                  }
                />

                <input
                  type="color"
                  value={
                    newRoleColor
                  }
                  onChange={(
                    event
                  ) =>
                    setNewRoleColor(
                      event.target
                        .value
                    )
                  }
                />

                <div className="permission-editor">
                  {Object.entries(
                    PERMISSION_LABELS
                  ).map(
                    ([
                      key,
                      label,
                    ]) => (
                      <label
                        key={key}
                        className="permission-row"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(
                            newRolePermissions[
                              key
                            ]
                          )}
                          onChange={() =>
                            toggleRolePermission(
                              key
                            )
                          }
                        />

                        <span>
                          {label}
                        </span>
                      </label>
                    )
                  )}
                </div>

                <div className="settings-actions">
                  <button
                    type="button"
                    className="small-button"
                    onClick={
                      resetRoleEditor
                    }
                  >
                    Clear
                  </button>

                  <button className="small-button primary">
                    {editingRoleId
                      ? 'Save role'
                      : 'Create role'}
                  </button>
                </div>
              </form>

              <div className="roles-list">
                {roles.map(
                  (role) => (
                    <div
                      className="role-item"
                      key={
                        role.id
                      }
                    >
                      <div className="role-info">
                        <span
                          className="role-color"
                          style={{
                            backgroundColor:
                              role.color,
                          }}
                        />

                        <span
                          style={{
                            color:
                              role.color,
                          }}
                        >
                          {role.name}
                        </span>
                      </div>

                      <div>
                        <button
                          onClick={() =>
                            beginEditRole(
                              role
                            )
                          }
                        >
                          ✏
                        </button>

                        <button
                          className="danger-action"
                          onClick={() =>
                            deleteRole(
                              role.id
                            )
                          }
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

      {/* MEMBERS */}

      {showMembers &&
        selectedServer && (
          <div
            className="modal-overlay"
            onClick={() =>
              setShowMembers(
                false
              )
            }
          >
            <div
              className="roles-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="settings-header">
                <div>
                  <span className="settings-kicker">
                    SERVER MANAGEMENT
                  </span>

                  <h2>
                    Members
                  </h2>
                </div>

                <button
                  className="modal-close"
                  onClick={() =>
                    setShowMembers(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <MemberList
                members={members}
                roles={roles}
                selectedServer={selectedServer}
                onlineUsers={onlineUsers}
                openUserProfile={openUserProfile}
                toggleMemberRole={toggleMemberRole}
                getInitial={getInitial}
              />
            </div>
          </div>
        )}

      <JoinServerModal open={joiningServer} onClose={() => setJoiningServer(false)} onJoin={joinServerByCode} />

      <ServerInviteModal
        open={showServerInvite && Boolean(selectedServer)}
        server={selectedServer}
        isOwner={selectedServer?.owner_id === session?.user?.id}
        onClose={() => setShowServerInvite(false)}
        onRegenerate={regenerateServerInviteCode}
      />

      <CreateServerModal
        open={creatingServer}
        value={serverName}
        onChange={setServerName}
        onClose={() => {
          setCreatingServer(false)
          setServerName('')
        }}
        onSubmit={createServer}
      />

      <CreateChannelModal
        open={creatingChannel}
        value={channelName}
        onChange={setChannelName}
        onClose={() => {
          setCreatingChannel(false)
          setChannelName('')
        }}
        onSubmit={createChannel}
      />

      {/* MEDIA CROPPER */}

      {cropperOpen &&
        cropperFile && (
          <MediaCropper
            file={cropperFile}
            type={cropperType}
            onCancel={() => {
              setCropperOpen(false)
              setCropperFile(null)
            }}
            onConfirm={
              handleCroppedMedia
            }
          />
        )}
    </div>
  )
}

export default App