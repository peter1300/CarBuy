import { tGlobal } from '../i18n/messages'

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
    return tGlobal('errors.avatarType')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return tGlobal('errors.avatarSize')
  }
  return null
}
