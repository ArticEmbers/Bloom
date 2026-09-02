import PresenceIndicator from './PresenceIndicator'

function MemberList({ members, roles, selectedServer, onlineUsers, openUserProfile, toggleMemberRole, getInitial }) {
  const statusOf = (member) => onlineUsers?.[member.user_id]?.status || 'offline'
  const groups = ['online', 'idle', 'dnd', 'offline']
  const labels = { online: 'ONLINE', idle: 'IDLE', dnd: 'DO NOT DISTURB', offline: 'OFFLINE' }

  return (
    <div className="member-groups">
      {groups.map((status) => {
        const group = members.filter((member) => statusOf(member) === status)
        if (!group.length) return null
        return (
          <section className="member-group" key={status}>
            <div className="member-group-title">{labels[status]} — {group.length}</div>
            {group.map((member) => {
              const profile = member.profiles || {}
              const assignedRoles = member.member_roles || []
              return (
                <div className="member-row" key={member.user_id}>
                  <button className="member-main" onClick={() => openUserProfile(member.user_id)}>
                    <span className="member-avatar-wrap">
                      <span className="avatar">
                        {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : getInitial(profile)}
                      </span>
                      <PresenceIndicator status={statusOf(member)} />
                    </span>
                    <span className="member-name-block">
                      <strong>{profile.username || 'Unknown'}</strong>
                      {selectedServer?.owner_id === member.user_id && <small>Owner</small>}
                    </span>
                  </button>
                  <div className="member-role-strip">
                    {roles.slice(0, 3).map((role) => {
                      const assigned = assignedRoles.some((item) => item.role_id === role.id)
                      return <button key={role.id} className={assigned ? 'assigned-role' : ''} style={assigned ? {borderColor: role.color, color: role.color} : {}} onClick={() => toggleMemberRole(member, role.id)}>{role.name}</button>
                    })}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
export default MemberList
