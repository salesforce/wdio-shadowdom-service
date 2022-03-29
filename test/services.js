/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const path = require('path')
const selenium = require('selenium-standalone')
const express = require('express')

const PORT = process.env.PORT || 8080

let seleniumServer
let staticServer

async function startSeleniumServer () {
  seleniumServer = await selenium.start()
}

function stopSeleniumServer () {
  return new Promise((resolve, reject) => {
    seleniumServer.on('error', reject)
    seleniumServer.on('exit', resolve)
    seleniumServer.kill()
  })
}

async function startStaticServer () {
  const app = express()
  app.use(express.static(path.join(__dirname, './www')))
  staticServer = await app.listen(PORT)
}

async function stopStaticServer () {
  await staticServer.close()
}

const start = () => Promise.all([startStaticServer(), startSeleniumServer()])
const stop = () => Promise.all([stopStaticServer(), stopSeleniumServer()])

module.exports = {
  start,
  stop
}
