# Jost — Just Jost (not Jest)

[![NPM version](https://badge.fury.io/js/jost.svg)](http://badge.fury.io/js/jost)

### `my-tests.js`

```javascript
#!/usr/bin/env node

import {beforeEach, afterEach, context, describe, expect, it} from 'jost';

describe('Jost', () => {
  it('expects', () => {
    expect(true).toBe(true);
  });
});

// etc...
```

### Output of `./my-tests.js`

```
Jost
  expects
0 errors, 1 example, 0 failures, 1 suite
```
