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
const kagekiriSource = fs.readFileSync(kagekiriSourceFilename, 'utf8')
// convert IIFE to something that always creates a global window.__kagekiri__ object
const kagekiriSourceAsGlobal = kagekiriSource.replace('var kagekiri', 'window.__kagekiri__')
// same thing, but keep it as an inline var, just rename kagekiri to __kagekiri__
const kagekiriSourceAsInline = kagekiriSource.replace('var kagekiri', 'var __kagekiri__')

function patchCodeToUseKagekiri (inputCode, hasKagekiriAsGlobal) {
  const propertyNames = ['querySelector', 'querySelectorAll']
  try {
    let { code } = transformSync(inputCode, {
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
    if (hasKagekiriAsGlobal) {
      // Add a check for the kagekiri global, which we can catch later if necessary
      const globalCheck = 'if (typeof __kagekiri__ === "undefined") { throw new Error("__kagekiri__ is undefined") }'
      code = `${globalCheck}\n${code}`
    } else {
      // If we were unable to load kagekiri as a global (i.e. `window.__kagekiri__`), then fall back to injecting
      // the entire kagekiri source along with the code. This is more inefficient (since the entire kagekiri source
      // has to be included in every call), but at least it works.
      code = `${kagekiriSourceAsInline}\n${code}`
    }
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

      function checkHasKagekiriAsGlobal () {
        return nonAsyncExecuteFunction.call(browser, 'return !!window.__kagekiri__')
      }

      function loadAndCheckHasKagekiriAsGlobal () {
        return nonAsyncExecuteFunction.call(
          browser,
          `return (function () { ${kagekiriSourceAsGlobal}; return !!window.__kagekiri__; })()`
        )
      }

      async function tryToLoadKagekiriAsGlobal () {
        if (await checkHasKagekiriAsGlobal()) {
          return true
        }
        return (await loadAndCheckHasKagekiriAsGlobal())
      }

      const hasKagekiriAsGlobal = await tryToLoadKagekiriAsGlobal()

      // If it's a string, webdriverio treats it as just the function body
      const scriptAsString = typeof script === 'function' ? `return (${script}).apply(null, arguments)` : script
      const newScript = patchCodeToUseKagekiri(scriptAsString, hasKagekiriAsGlobal)
      try {
        return (await origFunction.call(browser, newScript, ...args))
      } catch (err) {
        // Check if this is an error due to window.__kagekiri__ not being available.
        // This can happen if the page happens to redirect between when we write window.__kagekiri__ and
        // when we try to read window.__kagekiri__.
        const kagekiriGlobalError = hasKagekiriAsGlobal && err.message.includes('__kagekiri__ is undefined')
        if (kagekiriGlobalError) {
          // Recover by just inlining kagekiri instead of relying on the global
          const newScriptAsInline = patchCodeToUseKagekiri(scriptAsString, false)
          return (await origFunction.call(browser, newScriptAsInline, ...args))
        } else {
          throw err
        }
      }
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
