import { Linking } from 'react-native'

import { openPhone, openWebsite } from '../external-links'

const openURL = jest.spyOn(Linking, 'openURL')

beforeEach(() => openURL.mockReset().mockResolvedValue(true))

describe('openPhone', () => {
  it('asks to dial tel: plus the digits only', async () => {
    expect(await openPhone('028 7300 1234')).toBe(true)
    expect(openURL).toHaveBeenCalledWith('tel:02873001234')
    await openPhone('+84 (28) 7300-1234')
    expect(openURL).toHaveBeenLastCalledWith('tel:+842873001234')
  })
  it('reports false for no digits or an open failure, without rejecting', async () => {
    expect(await openPhone('n/a')).toBe(false)
    expect(openURL).not.toHaveBeenCalled()
    openURL.mockRejectedValue(new Error('no handler'))
    expect(await openPhone('0287')).toBe(false)
  })
})

describe('openWebsite', () => {
  it('adds https:// to a bare host and keeps http(s) as written', async () => {
    await openWebsite('rangrangcoffee.com')
    expect(openURL).toHaveBeenLastCalledWith('https://rangrangcoffee.com')
    await openWebsite(' http://a.example/x ')
    expect(openURL).toHaveBeenLastCalledWith('http://a.example/x')
    await openWebsite('host.example:8080')
    expect(openURL).toHaveBeenLastCalledWith('https://host.example:8080')
  })
  it('refuses every scheme but http and https', async () => {
    for (const bad of ['javascript:alert(1)', 'tel:123', 'mailto:a@b.c', 'file:///etc/passwd', 'intent://x', '']) {
      expect(await openWebsite(bad)).toBe(false)
    }
    expect(openURL).not.toHaveBeenCalled()
  })
  it('reports false, never rejects, when the link cannot open', async () => {
    openURL.mockRejectedValue(new Error('no handler'))
    expect(await openWebsite('a.example')).toBe(false)
  })
})
