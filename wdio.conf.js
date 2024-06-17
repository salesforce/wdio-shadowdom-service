/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const services = require('./test/services')
const plugin = require('./index.js')

const { DEBUG } = process.env
const chromeBinary = process.env.CHROME_BINARY
const chromedriverBinary = process.env.CHROMEDRIVER_BINARY

exports.config = {
  automationProtocol: 'webdriver',
  path: '/wd/hub',
  maxInstances: 1,
  timeout: DEBUG ? Number.MAX_SAFE_INTEGER : 60000,
  runner: 'local',
  specs: ['./test/spec/**/*.test.js'],
  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: DEBUG ? [] : ['--headless', '--disable-gpu'],
        ...(chromeBinary && { binary: chromeBinary })
      },
      ...(chromedriverBinary && {
        'wdio:chromedriverOptions': {
          binary: chromedriverBinary
        }
      })
    }
  ],
  logLevel: 'error',
  baseUrl: 'http://localhost:8080',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: DEBUG ? Number.MAX_SAFE_INTEGER : 60000
  },
  execArgv: DEBUG ? ['--inspect-brk'] : [],
  services: [[plugin, {}]],
  async onPrepare () {
    await services.start()
  },
  async onComplete () {
    await services.stop()
  }
}
