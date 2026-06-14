/**
 * Generates src/data/cards/generated.ts from cards-details.csv.
 *
 * cards-details.csv is the single source of truth for the card catalog.
 * Run after editing the CSV:
 *
 *   npx tsx scripts/generateCardDataFromCSV.ts
 *
 * The pure transform `generateFileContent(csvText)` is exported and covered by
 * src/__tests__/generatedMatchesCsv.test.ts, which fails CI if generated.ts
 * drifts from the CSV (either side edited without regenerating).
 */

// ---------------------------------------------------------------------------
// CSV parsing (RFC-4180-ish: quoted fields, "" escape, embedded newlines)
// ---------------------------------------------------------------------------

export type CsvRow = Record<string, string>

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { record.push(field); field = '' }
      else if (ch === '\n') { record.push(field); rows.push(record); record = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else field += ch
    }
  }
  if (field !== '' || record.length) { record.push(field); rows.push(record) }

  const header = rows[0]
  return rows
    .slice(1)
    .filter(r => r.length > 1 && r[1] !== '')
    .map(r => {
      const obj: CsvRow = {}
      header.forEach((h, i) => { obj[h] = r[i] ?? '' })
      return obj
    })
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

const IMAGE_PREFIX_FROM = '/attached_assets/card_images/'
const IMAGE_PREFIX_TO = '/cards/'

function transformImagePath(p: string): string {
  return p.startsWith(IMAGE_PREFIX_FROM)
    ? IMAGE_PREFIX_TO + p.slice(IMAGE_PREFIX_FROM.length)
    : p
}

/** JSON.stringify with 6-space indent, continuation lines prefixed by `indent`. */
function jsonBlock(value: unknown, indent: string): string {
  return JSON.stringify(value, null, 6).split('\n').join('\n' + indent)
}

/** A quoted string field line. */
function str(value: string): string {
  return JSON.stringify(value)
}

function renderAvatar(r: CsvRow): string {
  const lines: string[] = []
  lines.push('  {')
  lines.push(`    id: ${str(r.card_id)},`)
  lines.push(`    name: ${str(r.name)},`)
  lines.push(`    type: 'avatar',`)
  lines.push(`    element: ${str(r.element)},`)
  lines.push(`    subType: ${str(r.sub_type)},`)
  lines.push(`    level: ${Number(r.level)},`)
  lines.push(`    attack: ${Number(r.attack)},`)
  lines.push(`    health: ${Number(r.health)},`)
  lines.push(`    rarity: ${str(r.rarity)},`)
  lines.push(`    description: ${str(r.description)},`)
  if (r.skills) lines.push(`    skills: ${jsonBlock(JSON.parse(r.skills), '    ')},`)
  if (r.passive_skill) lines.push(`    passiveSkill: ${jsonBlock(JSON.parse(r.passive_skill), '    ')},`)
  lines.push(`    imagePath: ${str(transformImagePath(r.image_path))},`)
  lines.push(`    expansion: ${str(r.expansion)},`)
  lines.push(`    cardNumber: ${str(r.card_number)},`)
  lines.push('  },')
  return lines.join('\n')
}

/** Shared body for action cards and field cards (effect/spektra columns). */
function renderEffectCard(r: CsvRow, typeLiteral: string): string {
  const lines: string[] = []
  lines.push('  {')
  lines.push(`    id: ${str(r.card_id)},`)
  lines.push(`    name: ${str(r.name)},`)
  lines.push(`    type: ${typeLiteral},`)
  lines.push(`    element: ${str(r.element)},`)
  lines.push(`    rarity: ${str(r.rarity)},`)
  lines.push(`    description: ${str(r.description)},`)
  if (r.spektra_cost) {
    const spektra = JSON.parse(r.spektra_cost)
    if (Array.isArray(spektra) && spektra.length > 0) {
      lines.push(`    spektraCost: ${JSON.stringify(spektra)},`)
    }
  }
  if (r.effect_type) lines.push(`    effectType: ${str(r.effect_type)},`)
  if (r.effect_value !== '') lines.push(`    effectValue: ${Number(r.effect_value)},`)
  if (r.effect_value_2 !== '') lines.push(`    effectValue2: ${Number(r.effect_value_2)},`)
  if (r.effect_target) lines.push(`    effectTarget: ${str(r.effect_target)},`)
  lines.push(`    imagePath: ${str(transformImagePath(r.image_path))},`)
  lines.push(`    expansion: ${str(r.expansion)},`)
  lines.push(`    cardNumber: ${str(r.card_number)},`)
  lines.push('  },')
  return lines.join('\n')
}

function renderCard(r: CsvRow): string {
  if (r.type === 'avatar') return renderAvatar(r)
  if (r.type === 'field') return renderEffectCard(r, `'field'`)
  return renderEffectCard(r, str(r.type))
}

function renderArray(name: string, tsType: string, cards: CsvRow[]): string {
  const body = cards.map(renderCard).join('\n')
  return `export const ${name}: ${tsType}[] = [\n${body}\n]`
}

// ---------------------------------------------------------------------------
// File assembly
// ---------------------------------------------------------------------------

const HEADER =
  '// AUTO-GENERATED from cards-details.csv — do not edit manually\n' +
  '// Run: npx tsx scripts/generateCardDataFromCSV.ts\n' +
  '\n' +
  "import type { AvatarCard, ActionCard, FieldCard } from '../../types/card'\n"

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Fixed bucket order within a non-neutral element.
const ELEMENT_BUCKETS: { type: string; suffix: string; tsType: string }[] = [
  { type: 'avatar', suffix: 'AvatarCards', tsType: 'AvatarCard' },
  { type: 'spell', suffix: 'SpellCards', tsType: 'ActionCard' },
  { type: 'quickSpell', suffix: 'QuickSpellCards', tsType: 'ActionCard' },
  { type: 'ritualArmor', suffix: 'RitualArmorCards', tsType: 'ActionCard' },
  { type: 'field', suffix: 'FieldCards', tsType: 'FieldCard' },
]

export function generateFileContent(csvText: string): string {
  const rows = parseCsv(csvText)

  // Non-neutral elements in first-seen order.
  const elements: string[] = []
  for (const r of rows) {
    if (r.element !== 'neutral' && !elements.includes(r.element)) elements.push(r.element)
  }

  const blocks: string[] = []
  const spreadNames: string[] = []

  for (const el of elements) {
    for (const bucket of ELEMENT_BUCKETS) {
      const name = `csv${cap(el)}${bucket.suffix}`
      const cards = rows.filter(r => r.element === el && r.type === bucket.type)
      blocks.push(renderArray(name, bucket.tsType, cards))
      spreadNames.push(name)
    }
  }

  // Neutral: one combined array — non-field cards in row order, then field cards.
  const neutral = rows.filter(r => r.element === 'neutral')
  const neutralOrdered = [
    ...neutral.filter(r => r.type !== 'field'),
    ...neutral.filter(r => r.type === 'field'),
  ]
  blocks.push(renderArray('csvNeutralCards', '(ActionCard | FieldCard)', neutralOrdered))
  spreadNames.push('csvNeutralCards')

  const allCsv =
    'export const allCsvCards = [\n' +
    spreadNames.map(n => `  ...${n},`).join('\n') +
    '\n] as const'

  return HEADER + '\n' + blocks.join('\n\n') + '\n\n' + allCsv + '\n'
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')

  const here = dirname(fileURLToPath(import.meta.url))
  const root = join(here, '..')
  const csvPath = join(root, 'cards-details.csv')
  const outPath = join(root, 'src/data/cards/generated.ts')

  const csv = readFileSync(csvPath, 'utf8')
  const content = generateFileContent(csv)
  writeFileSync(outPath, content)
  console.log(`Wrote ${outPath} from ${csvPath}`)
}

// Run only when invoked directly (not when imported by the drift test).
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /generateCardDataFromCSV\.(ts|js|mjs)$/.test(process.argv[1] ?? '')

if (invokedDirectly) {
  main().catch(err => { console.error(err); process.exit(1) })
}
