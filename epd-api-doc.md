# EPD

> Stability: 1 - Experimental

The `epd` module provides enhanced peer dependency management functionality.

```js
const epd = require('epd');
```

## epd.install([options])

* `options` {Object}
* Returns: {Object}

Installs dependencies with enhanced peer dependency resolution.

## epd.scan([options])

* `options` {Object}
* Returns: {Object}

Scans for unused dependencies in the project.

## epd.security([options])

* `options` {Object}  
* Returns: {Object}

Performs security vulnerability scanning.

## epd.detectPackageManager()

* Returns: {string}

Detects the package manager being used (npm, yarn, or pnpm).