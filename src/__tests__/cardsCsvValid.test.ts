import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseCsv, type CsvRow } from '../../scripts/generateCardDataFromCSV'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const csvPath = join(root, 'cards-details.csv')

const RARITY = new Set(['Common', 'Uncommon', 'Rare', 'Super Rare', 'Mythic'])
const TYPE = new Set(['avatar', 'spell', 'quickSpell', 'ritualArmor', 'field', 'equipment', 'item'])
const ELEMENT = new Set(['fire', 'water', 'ground', 'air', 'neutral'])
const TRIBE = new Set(['kobar', 'borah', 'kuhaka', 'kujana', 'kuku'])
const ACTION_SUB = new Set(['equipment', 'healing', 'damage', 'draw', 'search', 'utility', 'destruction'])

const rows = parseCsv(readFileSync(csvPath, 'utf8'))

/** Collect every violation across all rows; one assertion lists them all. */
function collectErrors(): string[] {
  const errors: string[] = []
  const seenId = new Map<string, number>()
  const seenCardNumber = new Map<string, number>()

  rows.forEach((r, idx) => {
    const ref = `[${r.card_id || `row#${idx + 2}`}]`
    const isInt = (v: string) => v !== '' && Number.isInteger(Number(v))
    const jsonOk = (v: string) => { try { JSON.parse(v); return true } catch { return false } }

    if (!r.card_id) errors.push(`${ref} empty card_id`)
    else {
      const prev = seenId.get(r.card_id)
      if (prev !== undefined) errors.push(`${ref} duplicate card_id (also row#${prev + 2})`)
      seenId.set(r.card_id, idx)
    }

    if (!r.card_number) errors.push(`${ref} empty card_number`)
    else {
      const prev = seenCardNumber.get(r.card_number)
      if (prev !== undefined) errors.push(`${ref} duplicate card_number ${r.card_number} (also row#${prev + 2})`)
      seenCardNumber.set(r.card_number, idx)
    }

    if (!RARITY.has(r.rarity)) errors.push(`${ref} bad rarity "${r.rarity}"`)
    if (!TYPE.has(r.type)) errors.push(`${ref} bad type "${r.type}"`)
    if (!ELEMENT.has(r.element)) errors.push(`${ref} bad element "${r.element}"`)
    if (!r.expansion) errors.push(`${ref} empty expansion`)

    // image_path required + canonical prefix (the generator rewrites this prefix).
    if (!r.image_path) errors.push(`${ref} empty image_path`)
    else if (!r.image_path.startsWith('/attached_assets/card_images/')) {
      errors.push(`${ref} image_path missing /attached_assets/card_images/ prefix`)
    }

    // sub_type is polymorphic: tribe for avatars, ActionSubType (or empty) otherwise.
    if (r.type === 'avatar') {
      if (!TRIBE.has(r.sub_type)) errors.push(`${ref} avatar bad sub_type/tribe "${r.sub_type}"`)
      if (r.level !== '1' && r.level !== '2') errors.push(`${ref} avatar bad level "${r.level}"`)
      if (!isInt(r.attack)) errors.push(`${ref} avatar non-integer attack "${r.attack}"`)
      if (!isInt(r.health)) errors.push(`${ref} avatar non-integer health "${r.health}"`)
      if (!r.skills) errors.push(`${ref} avatar missing skills`)
    } else if (r.sub_type !== '' && !ACTION_SUB.has(r.sub_type)) {
      errors.push(`${ref} bad sub_type "${r.sub_type}"`)
    }

    // JSON columns must parse.
    if (r.skills && !jsonOk(r.skills)) errors.push(`${ref} skills is not valid JSON`)
    if (r.passive_skill && !jsonOk(r.passive_skill)) errors.push(`${ref} passive_skill is not valid JSON`)
    if (r.spektra_cost) {
      if (!jsonOk(r.spektra_cost)) errors.push(`${ref} spektra_cost is not valid JSON`)
      else if (!Array.isArray(JSON.parse(r.spektra_cost))) errors.push(`${ref} spektra_cost is not an array`)
    }

    if (r.effect_value !== '' && !isInt(r.effect_value)) errors.push(`${ref} non-integer effect_value "${r.effect_value}"`)
    if (r.effect_value_2 !== '' && !isInt(r.effect_value_2)) errors.push(`${ref} non-integer effect_value_2 "${r.effect_value_2}"`)
  })

  return errors
}

describe('cards-details.csv schema', () => {
  it('parses at least one card', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('has no schema violations', () => {
    const errors = collectErrors()
    expect(errors, `\n${errors.join('\n')}\n`).toHaveLength(0)
  })
})
