import { useEffect, useMemo, useState } from 'react';

function getInitials(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export default function MemberAvatar({ member, size = 'medium', className = '' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = useMemo(() => getInitials(member?.display_name || member?.email), [member?.display_name, member?.email]);
  const label = member?.display_name || member?.email || 'Workspace member';

  useEffect(() => {
    setImageFailed(false);
  }, [member?.avatar_url]);

  return (
    <span
      className={`member-avatar-image member-avatar-${size} ${className}`.trim()}
      title={label}
      aria-label={label}
    >
      {member?.avatar_url && !imageFailed ? (
        <img
          src={member.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
