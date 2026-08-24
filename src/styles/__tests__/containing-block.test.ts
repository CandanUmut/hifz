import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * An animation that touches `transform` makes its element a containing block
 * for every `position: fixed` descendant — and with a fill mode, permanently.
 *
 * `.page-enter` is on the element that wraps every in-shell screen, and the
 * surah page pins its action bar to the bottom of the window. When the
 * entrance animation slid up six pixels, that bar was positioned against the
 * page instead: on al-Baqara it sat 176,000 pixels down, so the only way to
 * reach "start memorising" was to scroll past all 286 ayah.
 *
 * Nothing about six pixels of movement is worth that, and the mistake is
 * invisible on every short page, so it is worth a test rather than a comment.
 */
describe('the page entrance animation', () => {
  it('never animates a property that creates a containing block', async () => {
    const css = await readFile(path.resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
    const block = /@keyframes page-enter\s*\{([\s\S]*?)\n\}/.exec(css)
    expect(block, 'page-enter keyframes should exist').not.toBeNull()

    for (const property of ['transform', 'translate', 'rotate', 'scale', 'filter', 'perspective']) {
      expect(block![1], `page-enter must not animate ${property}`).not.toContain(property)
    }
  })
})
