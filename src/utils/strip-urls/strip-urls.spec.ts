import {stripUrls} from "./strip-urls";

describe('strip-urls', () => {
    describe('Given stripUrls', () => {
        const url = 'https://host.com/path/to/file.html'

        describe('when "{url}" provided', () => {
            test('then return ""', () => {
                expect(stripUrls(url)).toEqual('')
            })
        })

        describe('when "http://host.com/path/to/file.html" provided', () => {
            test('then return ""', () => {
                expect(stripUrls('http://host.com/path/to/file.html')).toEqual('')
            })
        })

        describe('when "This is a test {url}." provided', () => {
            test('then return "This is a test "', () => {
                expect(stripUrls(`This is a test ${url}.`)).toEqual('This is a test ')
            })
        })

        describe('when "This is a test {url})" provided', () => {
            test('then return "This is a test "', () => {
                expect(stripUrls(`This is a test ${url})`)).toEqual('This is a test ')
            })
        })

        describe('when "This is a test {url} )" provided', () => {
            test('then return "This is a test  )"', () => {
                expect(stripUrls(`This is a test ${url} )`)).toEqual('This is a test  )')
            })
        })
    })
})