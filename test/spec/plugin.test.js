/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* global describe it beforeEach browser $ $$ */
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai

describe('plugin', () => {
  describe('basic', () => {
    beforeEach(async () => {
      await browser.url('/shadowdom.html')
    })

    it('can pierce the shadow dom', async () => {
      const element = await $('.text')
      expect(element.error).to.equal(undefined)
      expect(element.selector).to.equal('.text')
      expect(element.parent).to.equal(browser)
      await element.waitForExist()
      const text = await element.getText()
      expect(text).to.equal('Hello from the shadow DOM')
    })

    it('can get shadow elements the old-fashioned way, without the plugin', async () => {
      await (await $('.done')).waitForExist()
      const element = await (await $('custom-component')).shadow$('.text')
      expect(element.error).to.equal(undefined)
      const text = await element.getText()
      expect(text).to.equal('Hello from the shadow DOM')
    })

    it('can click buttons in the shadow dom', async () => {
      await (await $('.btn')).click()
      expect(await (await $('.text')).getText()).to.equal('I was changed!')
    })

    it('can use $$', async () => {
      const selector = 'custom-component, .btn, .text'
      const elements = await $$(selector)
      expect(elements.selector).to.equal(selector)
      expect(elements.parent).to.equal(browser)
      expect(elements.foundWith).to.equal('$$')
      expect(elements.map(_ => _.selector)).to.deep.equal(elements.map(() => selector))
      expect(elements.map(_ => _.index)).to.deep.equal([0, 1, 2])
      expect(await Promise.all(elements.map(_ => _.getAttribute('class'))))
        .to.deep.equal(['custom', 'text', 'btn'])
    })

    it('can use findElement() and findElements()', async () => {
      const selector = '.text'
      const element = await browser.findElement('css selector', selector)
      expect(element.selector).to.equal(selector)
      expect(await element.getText()).to.equal('Hello from the shadow DOM')
      const elements = await browser.findElements('css selector', selector)
      expect(elements.selector).to.equal(selector)
      expect(elements[0].selector).to.equal(selector)
      expect(await elements[0].getText()).to.equal('Hello from the shadow DOM')
    })

    it('can use execute()', async () => {
      expect(await browser.execute(
        function () {
          return document.querySelector('.text').innerText
        }
      )).to.equal('Hello from the shadow DOM')
      expect(await
      browser.execute('return document.querySelector(\'.text\').innerText;')
      ).to.equal('Hello from the shadow DOM')
      expect(await browser.execute(
        function (selector) {
          return document.querySelector(selector).innerText
        },
        '.text'
      )).to.equal('Hello from the shadow DOM')
      expect(await browser.execute(
        'return document.querySelector(arguments[0]).innerText;',
        '.text'
      )).to.equal('Hello from the shadow DOM')
      expect(await browser.execute(
        () => document.querySelector('.text').innerText
      )).to.equal('Hello from the shadow DOM')
      expect(await browser.execute(
        selector => document.querySelector(selector).innerText,
        '.text'
      )).to.equal('Hello from the shadow DOM')
    })

    it('can use executeAsync()', async () => {
      expect(await browser.executeAsync(function (done) {
        setTimeout(function () {
          done(document.querySelector('.outer .inner .text').innerText)
        })
      })).to.equal('Hello from the shadow DOM')
      expect(await browser.executeAsync(function (done) {
        setTimeout(function () {
          done([...document.querySelectorAll('.outer .inner .text')].map(_ => _.innerText))
        })
      })).to.deep.equal(['Hello from the shadow DOM'])
    })

    it('does not affect xpath selectors', async () => {
      const selector = '//*[@id="hello-world"]'
      expect(await (await $(selector)).getText()).to.equal('Hello world!')
      expect(await Promise.all((await $$(selector)).map(_ => _.getText()))).to.deep.equal([
        'Hello world!'
      ])
    })

    it('can pass functions in to $()', async () => {
      expect(await (await $(function () {
        return document.querySelector('.text')
      })).getText()).to.equal('Hello from the shadow DOM')
      expect(await (await $(() => document.querySelector('.text'))).getText()).to.equal('Hello from the shadow DOM')
    })

    it('can pass functions in to $$()', async () => {
      expect(await (await $$(function () {
        return document.querySelector('.text')
      }))[0].getText()).to.equal('Hello from the shadow DOM')
      expect(await (await $$(() => document.querySelector('.text')))[0].getText()).to.equal('Hello from the shadow DOM')
    })

    it('can query the shadow DOM using foo.querySelector()', async () => {
      expect(await browser.execute(() => {
        const body = document.querySelector('body')
        const outer = body.querySelector('.outer')
        const inner = outer.querySelector('.inner')
        const text = inner.querySelector('.text')
        return text.innerText
      })).to.equal('Hello from the shadow DOM')

      expect(await browser.execute(() => {
        const doc = document
        return doc.querySelector('.text').innerText
      })).to.equal('Hello from the shadow DOM')
    })

    it('works with iframes and when changing urls', async () => {
      expect(await (await $('.text')).getText()).to.equal('Hello from the shadow DOM')
      await browser.switchToFrame(await $('iframe'))
      expect(await (await $('.text')).getText()).to.equal('Hello from the other shadow DOM')
      await browser.url('/othershadowdom.html')
      expect(await (await $('.text')).getText()).to.equal('Hello from the other shadow DOM')
    })

    it('throws an error on an invalid CSS selector', async () => {
      const fails = async () => {
        await (await $('.invalid;')).getText()
      }
      await expect(fails()).to.be.rejectedWith(Error)
    })
  })

  describe('frozen window', () => {
    beforeEach(async () => {
      await browser.url('/frozenwindow.html')
    })

    it('recovers when it is impossible to write to window.__kagekiri__', async () => {
      expect(await (await $('span')).getText()).to.equal('find me!')
    })
  })

  describe('autorefreshes', () => {
    beforeEach(async () => {
      await browser.url('/autorefreshes.html')
    })

    it('recovers when the page redirects after writing to window.__kagekiri__', async () => {
      const span = await $('span')
      await span.waitForExist()
      expect(await span.getText()).to.equal('find me!')
    })
  })
})
