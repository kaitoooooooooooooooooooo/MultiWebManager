import { describe, expect, it } from 'vitest'
import { isAllowedNavigationUrl, normalizeUserUrl } from '../src/shared/url'

const search = (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`

describe('normalizeUserUrl', () => {
  it.each([
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['http://example.com', 'http://example.com/'],
    ['example.com', 'https://example.com/'],
    ['www.ceff.ch/formations', 'https://www.ceff.ch/formations'],
    ['zürich.ch', 'https://xn--zrich-kva.ch/'],
    ['example.com:8443/x', 'https://example.com:8443/x'],
    ['localhost:5173', 'http://localhost:5173/'],
    ['127.0.0.1:8080/api', 'http://127.0.0.1:8080/api'],
    ['192.168.1.20', 'https://192.168.1.20/'],
    ['about:blank', 'about:blank']
  ])('%s → %s', (input, expected) => {
    expect(normalizeUserUrl(input)).toEqual({ ok: true, url: expected })
  })

  it.each(['météo bienne', 'electron webcontentsview', 'index.html avec espace'])('« %s » devient une recherche', (input) => {
    expect(normalizeUserUrl(input)).toEqual({ ok: true, url: search(input) })
  })

  it.each(['javascript:alert(1)', 'file:///C:/Windows/win.ini', 'chrome://settings', 'data:text/html,<b>x</b>', 'mailto:a@b.ch'])(
    'refuse %s',
    (input) => {
      expect(normalizeUserUrl(input).ok).toBe(false)
    }
  )

  it('refuse une adresse vide', () => {
    expect(normalizeUserUrl('   ').ok).toBe(false)
  })
})

describe('isAllowedNavigationUrl', () => {
  it('n’accepte que http(s) et about:blank', () => {
    expect(isAllowedNavigationUrl('https://a.ch')).toBe(true)
    expect(isAllowedNavigationUrl('about:blank')).toBe(true)
    expect(isAllowedNavigationUrl('about:config')).toBe(false)
    expect(isAllowedNavigationUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedNavigationUrl('pas une url')).toBe(false)
  })
})
