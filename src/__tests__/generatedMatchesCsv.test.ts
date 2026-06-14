import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generateFileContent } from '../../scripts/generateCardDataFromCSV'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const csvPath = join(root, 'cards-details.csv')
const generatedPath = join(root, 'src/data/cards/generated.ts')

describe('cards-details.csv -> generated.ts', () => {
  it('generated.ts is byte-identical to a fresh regeneration from the CSV', () => {
    const csv = readFileSync(csvPath, 'utf8')
    const expected = generateFileContent(csv)
    const actual = readFileSync(generatedPath, 'utf8')
    expect(actual).toBe(expected)
    // If this fails: CSV (source of truth) was edited without regenerating,
    // or generated.ts was hand-edited. Run:
    //   npx tsx scripts/generateCardDataFromCSV.ts
  })
})
