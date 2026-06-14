import type { AvatarCard, Skill } from '../types/card'

/**
 * Normalize an avatar's skills into a single array. Supports both the modern
 * `skills` array and the legacy `skill1` / `skill2` fields.
 */
export function getSkills(avatar: AvatarCard): Skill[] {
  return avatar.skills ?? [avatar.skill1, avatar.skill2].filter((s): s is Skill => !!s)
}
