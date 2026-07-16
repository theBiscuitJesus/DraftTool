import { describe, it, expect, beforeEach } from 'vitest'
import { run } from '../scripts/assemble-decklist.js'
import { existsSync, rmSync, readFileSync, mkdirSync } from 'node:fs'

const OUT = 'scratch/test-out'
beforeEach(() => { rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true }) })

describe('assemble-decklist CLI', () => {
  it('assembles both pages into a valid 40-card deck and writes it', () => {
    const r = run(['tests/fixtures/main-page.json', 'tests/fixtures/mar-page.json', '--write', '--out', OUT])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).not.toContain('ERROR:')
    expect(r.stdout).toContain('Player: Michael Steele (Table 125)')
    expect(r.stdout).toContain('DRAFTED-NOT-PLAYED: 1 The Thing, Ben Grimm')
    const file = readFileSync(`${OUT}/125-steele.txt`, 'utf8')
    expect(file).toContain('2 Heroic Intervention')
    expect(file).toContain('9 Plains')
    expect(file).not.toContain('DRAFTED')
  })

  it('writes handoff JSON alongside the txt', () => {
    run(['tests/fixtures/main-page.json', 'tests/fixtures/mar-page.json', '--write', '--out', OUT])
    const json = JSON.parse(readFileSync(`${OUT}/125-steele.json`, 'utf8'))
    expect(json.player).toEqual({ firstName: 'Michael', lastName: 'Steele', table: '125' })
    expect(json.playedTotal).toBe(40)
    expect(json.cards.find((c: { name: string }) => c.name === 'Heroic Intervention').qty).toBe(2)
    expect(json.basics.find((c: { name: string }) => c.name === 'Plains').qty).toBe(9)
  })

  it('errors and refuses to write when the sum is not 40', () => {
    const r = run(['tests/fixtures/main-page.json', '--write', '--out', OUT])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain('ERROR:')
    expect(r.stdout).toContain('37')
    expect(existsSync(`${OUT}/125-steele.txt`)).toBe(false)
  })

  it('writes anyway with --force', () => {
    const r = run(['tests/fixtures/main-page.json', '--write', '--force', '--out', OUT])
    expect(r.exitCode).toBe(1)
    expect(existsSync(`${OUT}/125-steele.txt`)).toBe(true)
  })

  it('rejects recognition JSON with a wrong-case page value instead of warning on unknown rows', () => {
    const r = run(['tests/fixtures/bad-page-case.json'])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain('ERROR: tests/fixtures/bad-page-case.json:')
    expect(r.stdout.toLowerCase()).toContain('page')
    expect(r.stdout).not.toContain('unknown row')
    expect(r.stdout).not.toContain('\n    at ') // no stack trace
  })

  it('gives a clean usage error when --out is the final argument with no value', () => {
    const r = run(['tests/fixtures/main-page.json', 'tests/fixtures/mar-page.json', '--write', '--out'])
    expect(r.exitCode).toBe(1)
    expect(r.stdout.toLowerCase()).toContain('usage')
    expect(r.stdout).not.toContain('\n    at ')
  })

  it('gives a clean usage error when --out is followed by another flag', () => {
    const r = run(['tests/fixtures/main-page.json', '--out', '--write'])
    expect(r.exitCode).toBe(1)
    expect(r.stdout.toLowerCase()).toContain('usage')
    expect(r.stdout).not.toContain('\n    at ')
  })

  it('reports a clean error for a mistyped input path instead of crashing', () => {
    const r = run(['tests/fixtures/does-not-exist.json'])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain('ERROR: cannot read tests/fixtures/does-not-exist.json:')
    expect(r.stdout).not.toContain('\n    at ')
  })

  it('reports a clean error for malformed JSON instead of crashing', () => {
    const r = run(['tests/fixtures/malformed.json'])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain('ERROR: cannot read tests/fixtures/malformed.json:')
    expect(r.stdout).not.toContain('\n    at ')
  })
})
