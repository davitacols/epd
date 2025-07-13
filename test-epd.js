'use strict';

const common = require('../common');
const assert = require('assert');
const epd = require('epd');

// Test EPD module functionality
{
  // Test detectPackageManager
  const pm = epd.detectPackageManager();
  assert(typeof pm === 'string');
  assert(['npm', 'yarn', 'pnpm'].includes(pm));
}

{
  // Test scan function
  const result = epd.scan();
  assert(typeof result === 'object');
  assert(Array.isArray(result.unused));
  assert(typeof result.total === 'number');
}

{
  // Test security function
  const result = epd.security();
  assert(typeof result === 'object');
  assert(typeof result.vulnerabilities === 'object');
}