import {expect} from 'chai'
import {
  getErrorMessage,
  hasErrorCode,
  hasStatusCode,
} from '../../src/utils/error.js'

describe('error utilities', () => {
  describe('getErrorMessage', () => {
    it('extracts message from Error instance', () => {
      const error = new Error('Something went wrong')
      expect(getErrorMessage(error)).to.equal('Something went wrong')
    })

    it('returns string errors directly', () => {
      expect(getErrorMessage('Direct string error')).to.equal('Direct string error')
    })

    it('extracts message from plain object with message property', () => {
      const error = {message: 'Object error message'}
      expect(getErrorMessage(error)).to.equal('Object error message')
    })

    it('handles null gracefully', () => {
      const result = getErrorMessage(null)
      expect(result).to.equal('null')
    })

    it('handles undefined gracefully', () => {
      const result = getErrorMessage(undefined)
      expect(result).to.equal('undefined')
    })

    it('handles numbers by converting to string', () => {
      expect(getErrorMessage(404)).to.equal('404')
    })

    it('handles objects without message property', () => {
      const error = {code: 'ERR_NETWORK', status: 500}
      const result = getErrorMessage(error)
      expect(result).to.be.a('string')
    })

    it('ignores non-string message properties', () => {
      const error = {message: 12345}
      const result = getErrorMessage(error)
      // Should not use the number as a message, falls through to String()
      expect(result).to.be.a('string')
    })

    it('handles Error subclasses', () => {
      const error = new TypeError('Type mismatch')
      expect(getErrorMessage(error)).to.equal('Type mismatch')
    })
  })

  describe('hasErrorCode', () => {
    it('returns true when error has matching code', () => {
      const error = {code: 'ENOTFOUND', message: 'Host not found'}
      expect(hasErrorCode(error, 'ENOTFOUND')).to.be.true
    })

    it('returns false when error has different code', () => {
      const error = {code: 'ECONNREFUSED', message: 'Connection refused'}
      expect(hasErrorCode(error, 'ENOTFOUND')).to.be.false
    })

    it('returns false when error has no code property', () => {
      const error = {message: 'Some error'}
      expect(hasErrorCode(error, 'ENOTFOUND')).to.be.false
    })

    it('returns false for null', () => {
      expect(hasErrorCode(null, 'ENOTFOUND')).to.be.false
    })

    it('returns false for undefined', () => {
      expect(hasErrorCode(undefined, 'ENOTFOUND')).to.be.false
    })

    it('returns false for primitive values', () => {
      expect(hasErrorCode('string error', 'ENOTFOUND')).to.be.false
      expect(hasErrorCode(123, 'ENOTFOUND')).to.be.false
    })

    it('works with Error instances that have code property', () => {
      const error = new Error('Network error') as Error & {code: string}
      error.code = 'ETIMEDOUT'
      expect(hasErrorCode(error, 'ETIMEDOUT')).to.be.true
    })

    it('handles common network error codes', () => {
      expect(hasErrorCode({code: 'ENOTFOUND'}, 'ENOTFOUND')).to.be.true
      expect(hasErrorCode({code: 'ECONNREFUSED'}, 'ECONNREFUSED')).to.be.true
      expect(hasErrorCode({code: 'ETIMEDOUT'}, 'ETIMEDOUT')).to.be.true
      expect(hasErrorCode({code: 'ESOCKETTIMEDOUT'}, 'ESOCKETTIMEDOUT')).to.be.true
    })
  })

  describe('hasStatusCode', () => {
    it('returns true when error has numeric statusCode', () => {
      const error = {statusCode: 401, message: 'Unauthorized'}
      expect(hasStatusCode(error)).to.be.true
      if (hasStatusCode(error)) {
        expect(error.statusCode).to.equal(401)
      }
    })

    it('returns false when error has no statusCode', () => {
      const error = {message: 'Some error'}
      expect(hasStatusCode(error)).to.be.false
    })

    it('returns false when statusCode is not a number', () => {
      const error = {statusCode: '401', message: 'Unauthorized'}
      expect(hasStatusCode(error)).to.be.false
    })

    it('returns false for null', () => {
      expect(hasStatusCode(null)).to.be.false
    })

    it('returns false for undefined', () => {
      expect(hasStatusCode(undefined)).to.be.false
    })

    it('returns false for primitive values', () => {
      expect(hasStatusCode('string error')).to.be.false
      expect(hasStatusCode(123)).to.be.false
    })

    it('works with common HTTP status codes', () => {
      expect(hasStatusCode({statusCode: 400})).to.be.true
      expect(hasStatusCode({statusCode: 401})).to.be.true
      expect(hasStatusCode({statusCode: 403})).to.be.true
      expect(hasStatusCode({statusCode: 404})).to.be.true
      expect(hasStatusCode({statusCode: 429})).to.be.true
      expect(hasStatusCode({statusCode: 500})).to.be.true
      expect(hasStatusCode({statusCode: 502})).to.be.true
      expect(hasStatusCode({statusCode: 503})).to.be.true
    })

    it('works with Error instances that have statusCode property', () => {
      const error = new Error('API error') as Error & {statusCode: number}
      error.statusCode = 500
      expect(hasStatusCode(error)).to.be.true
      if (hasStatusCode(error)) {
        expect(error.statusCode).to.equal(500)
      }
    })
  })
})
