# wdio-shadowdom-service [![build status](https://circleci.com/gh/salesforce/wdio-shadowdom-service.svg?style=svg)](https://circleci.com/gh/salesforce/wdio-shadowdom-service)


This is a plugin for [WebDriverIO](http://webdriver.io/) that transparently makes CSS selectors "just work" with the
[shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM).

With this plugin, APIs like `$('.foo')` and `$$('.foo')`will automatically query inside the shadow DOM to find elements. This can help avoid
complicated or hard-to-maintain test code.

**Before:**

```js
// 😞
const element = $('.foo')
  .shadow$('.bar')
  .shadow$('.baz')
  .shadow$('.quux')
```

**After:**

```js
// 🥳
const element = $('.quux') 
```

**Features:**

- APIs like `$`, `$$`, and even some basic usage of `execute` all "just work" with the shadow DOM. 
- Doesn't override the global `document.querySelector` or `document.querySelectorAll`. Only touches your test code, not your production code.
- Uses [kagekiri](https://github.com/salesforce/kagekiri) under the hood – a rigorously-tested utility containing a full CSS selector parser.

## Install

```sh
npm install wdio-shadowdom-service
```

## Usage

### Configuration

Modify your `wdio.conf.js` like so:

```js
const ShadowDomService = require('wdio-shadowdom-service')

exports.config = {
    // ...
    services: [ [ShadowDomService, {}] ],
    // ...
}
```

### Use the `webdriver` protocol

Due to [an open bug on WebDriverIO](https://github.com/webdriverio/webdriverio/issues/4484),
you will also need to use the `webdriver` protocol, not the `devtools` protocol. Set this in your `wdio.conf.js`:

```js
exports.config = {
  // ...
  automationProtocol: 'webdriver',
  path: '/wd/hub',
  // ...
}
```

### Examples

Now you can use selector queries that pierce the shadow DOM:

```js
const element = await browser.$('.foo')
const elements = await browser.$$('.foo')
```

Some simple usages of `document.querySelector`/`querySelectorAll` are also supported:

```js
const element = await browser.execute(() => document.querySelector('.foo'))
const elements = await browser.execute(() => document.querySelectorAll('.foo'))
```

All selectors are able to pierce the shadow DOM, including selectors like `'.outer .inner'` where `.outer` is in the
light DOM and `.inner` is in the shadow DOM. See [kagekiri](https://github.com/salesforce/kagekiri) for more details
on how it works.

### Supported APIs

- [$](https://webdriver.io/docs/api/element/$)
- [$$](https://webdriver.io/docs/api/element/$$)
- [execute](https://webdriver.io/docs/api/browser/execute/) \*
- [executeAsync](https://webdriver.io/docs/api/browser/executeAsync/) \*
- [findElement](https://webdriver.io/docs/api/webdriver#findelement)
- [findElements](https://webdriver.io/docs/api/webdriver#findelements)

\* `execute` and `executeAsync` only work with simple usages of `document.querySelector`/`querySelectorAll` 
or `element.querySelector`/`querySelectorAll`.

Currently, WebDriverIO v6 and v7 are supported.

## Contributing

To lint:

```sh
npm run lint
```

To fix most lint issues automatically:

```sh
npm run lint:fix
```

To run the tests:

```sh
npm test
```

To run the tests in debug mode:

```sh
DEBUG=true npm test
```

Then open `chrome:inspector` in Chrome and open the dedicated DevTools for Node.
test
