/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const fs = require('fs')
const { transformSync } = require('@babel/core')
const { cloneNode } = require('@babel/types')

const kagekiriSourceFilename = require.resolve('kagekiri/dist/kagekiri.iife.min.js')
// convert IIFE to something that always creates a global window.__kagekiri__ object
const kagekiriSource = fs.readFileSync(kagekiriSourceFilename, 'utf8')
  .replace('var kagekiri', 'window.__kagekiri__')

function patchCodeToUseKagekiri (inputCode) {
  const propertyNames = ['querySelector', 'querySelectorAll']
  try {
    const { code } = transformSync(inputCode, {
      parserOpts: {
        allowReturnOutsideFunction: true
      },
      plugins: [{
        visitor: {
          CallExpression (path) {
            const { type, node } = path
            const { callee, arguments: args } = node
            if (type === 'CallExpression' && callee.type === 'MemberExpression' && callee.object.type === 'Identifier' &&
              callee.property.type === 'Identifier' &&
              propertyNames.includes(callee.property.name) && args.length === 1) {
              // `document.querySelector('div')` -> `__kagekiri__.querySelector('div')`
              // `element.querySelector('div')` -> `__kagekiri__.querySelector('div', element)`
              if (callee.object.name !== 'document') {
                args.push(cloneNode(callee.object))
              }
              callee.object.name = '__kagekiri__'
            }
          }
        }
      }]
    })
    return code
  } catch (err) {
    // This can happen if the input is not JavaScript, e.g. Chromedriver-specific commands like `:takeHeapSnapshot`.
    // In that case, just return the input code and don't transform it.
    return inputCode
  }
}

function createElementLocator (selector, multi) {
  // `document` will be automatically replaced with `__kagekiri__`
  // eslint-disable-next-line no-new-func
  return new Function(`return document.querySelector${multi ? 'All' : ''}(${JSON.stringify(selector)})`)
}

// overwrite all commands that need to be overwritten here
function shimShadowDom (browser) {
  browser.overwriteCommand('findElement', async function (origFindElement, strategy, selector) {
    if (strategy !== 'css selector') {
      return origFindElement.call(browser, strategy, selector)
    }

    const elementLocator = createElementLocator(selector, false)

    const element = await browser.$(elementLocator)
    element.selector = selector
    return element
  })

  browser.overwriteCommand('findElements', async function (origFindElements, strategy, selector) {
    if (strategy !== 'css selector') {
      return origFindElements.call(browser, strategy, selector)
    }

    const elementLocator = createElementLocator(selector, true)

    const elements = await browser.$$(elementLocator)
    elements.selector = selector
    for (const element of elements) {
      element.selector = selector
    }
    return elements
  })

  function overrideExecute (isAsync) {
    return async function (origFunction, script, ...args) {
      // If overriding client.execute(), we don't want to get caught in an infinite loop.
      // If overriding client.executeAll(), then calling client.execute() is fine.
      const nonAsyncExecuteFunction = isAsync ? browser.execute : origFunction

      function checkHasKagekiri () {
        return nonAsyncExecuteFunction.call(browser, 'return !!window.__kagekiri__')
      }

      function loadAndCheckHasKagekiri () {
        return nonAsyncExecuteFunction.call(
          browser,
          `return (function () { ${kagekiriSource}; return !!window.__kagekiri__; })()`
        )
      }

      async function loadKagekiriIfNecessary () {
        if (!(await checkHasKagekiri())) {
          const hasKagekiri = await loadAndCheckHasKagekiri()
          if (!hasKagekiri) {
            throw new Error('unable to load kagekiri')
          }
        }
      }

      await loadKagekiriIfNecessary()

      // If it's a string, webdriverio treats it as just the function body
      const scriptAsString = typeof script === 'function' ? `return (${script}).apply(null, arguments)` : script
      const newScript = patchCodeToUseKagekiri(scriptAsString)
      return origFunction.call(browser, newScript, ...args)
    }
  }

  browser.overwriteCommand('execute', overrideExecute(false))
  browser.overwriteCommand('executeAsync', overrideExecute(true))
}

class ShadowDomService {
  before (capabilities, specs, browser) {
    shimShadowDom(browser)
  }
}

module.exports = ShadowDomService
