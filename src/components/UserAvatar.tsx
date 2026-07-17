import { initialsFromName } from '../lib/avatar'

type Props = {
  name: string
  avatarUrl?: string | null
  className: string
}

export function UserAvatar({ name, avatarUrl, className }: Props) {
  if (avatarUrl) {
    return <img className={`${className} has-image`} src={avatarUrl} alt="" />
  }
  return (
    <div className={className} aria-hidden="true">
      {initialsFromName(name)}
    </div>
  )
}
