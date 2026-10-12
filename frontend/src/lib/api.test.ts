import { describe, expect, it } from 'vitest'

import { ApiError, withQuery } from './api'

describe('withQuery', () => {
  it('drops empty values and encodes the rest', () => {
    expect(withQuery('/attendance', { from: '2026-03-01', status: '', employee: undefined, page: 2 })).toBe(
      '/attendance?from=2026-03-01&page=2',
    )
    expect(withQuery('/x', { q: 'a b&c' })).toBe('/x?q=a+b%26c')
    expect(withQuery('/x', {})).toBe('/x')
  })

  it('appends to an existing query string', () => {
    expect(withQuery('/x?a=1', { b: 2 })).toBe('/x?a=1&b=2')
  })
})

describe('ApiError', () => {
  it('flags network errors', () => {
    expect(new ApiError(0, 'offline').isNetworkError).toBe(true)
    expect(new ApiError(400, 'bad', { name: ['required'] }).fieldErrors.name).toEqual(['required'])
  })
})
