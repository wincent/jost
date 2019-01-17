/**
 * Simple test harness that provides a Jest-like API.
 *
 * Beware: skips a lot of the behavior and edge-case handling that Jest
 * implements.
 *
 * Cheat-sheet:
 *
 * - Run tests using the harness: `some-file-containing-tests.js`
 * - Run in "watch" mode: `watch some-file-containing-tests.js`
 * - Same, but colorized: `watch -c some-file-containing-tests.js`
 */
const assert = require('assert');
const util = require('util');

const stack = [
  {
    afterHooks: [],
    beforeHooks: [],
    blocks: [],
    depth: -1,
    label: null,
    parent: null,
    type: 'suite',
  },
];
const stats = {
  errors: 0,
  examples: 0,
  failures: 0,
  suites: 0,
};

const {colors} = util.inspect;

function wrap(string, codes) {
  return `\x1b[${codes[0]}m${string}\x1b[${codes[1]}m`;
}

const format = {
  bold(string) {
    return wrap(string, colors.bold);
  },
  red(string) {
    return wrap(string, colors.red);
  },
  underline(string) {
    return wrap(string, colors.underline);
  },
};

function afterEach(callback) {
  const {afterHooks} = stack[stack.length - 1];
  afterHooks.push(callback);
}

function beforeEach(callback) {
  const {beforeHooks} = stack[stack.length - 1];
  beforeHooks.push(callback);
}

function expect(condition) {
  const matcherBuilders = {
    toBe(conjunction, predicate) {
      return value => {
        assert(
          predicate(condition === value),
          `Expected ${condition} ${conjunction} be ${value}`,
        );
      };
    },

    toBeInstanceOf(conjunction, predicate) {
      return value => {
        assert(
          predicate(condition instanceof value),
          `Expected ${condition} ${conjunction} be instance of ${value}`,
        );
      };
    },

    toEndWith(conjunction, predicate) {
      return string => {
        assert(
          predicate(condition.endsWith(string)),
          `Expected ${condition} ${conjunction} end with ${string}`,
        );
      };
    },

    toEqual(conjunction, predicate) {
      return jsonable => {
        const expected = JSON.stringify(jsonable);
        const actual = JSON.stringify(condition);
        assert(
          predicate(expected === actual),
          `Expected ${actual} ${conjunction} equal ${expected}`,
        );
      };
    },

    toMatch(conjunction, predicate) {
      return stringOrRegExp => {
        let match;
        if (typeof stringOrRegExp === 'string') {
          match = condition.indexOf(stringOrRegExp) !== -1;
        } else {
          match = condition.match(stringOrRegExp);
        }
        assert(
          predicate(match),
          `Expected ${condition} ${conjunction} match ${stringOrRegExp}`,
        );
      };
    },

    toStartWith(conjunction, predicate) {
      return string => {
        assert(
          predicate(condition.startsWith(string)),
          `Expected ${condition} ${conjunction} start with ${string}`,
        );
      };
    },

    toThrow(conjunction, predicate) {
      return pattern => {
        let thrown;
        try {
          condition();
        } catch (error) {
          if (pattern) {
            const string = String(
              error instanceof Error ? error.message : error,
            );
            thrown =
              pattern instanceof RegExp
                ? pattern.test(string)
                : string.includes(pattern);
          } else {
            thrown = error;
          }
        }
        assert(
          predicate(thrown),
          `Expected ${condition} ${conjunction} throw error`,
        );
      };
    },
  };

  return {
    ...Object.entries(matcherBuilders).reduce((acc, [key, matcherBuilder]) => {
      acc[key] = matcherBuilder('to', condition => !!condition);
      return acc;
    }, {}),
    not: {
      ...Object.entries(matcherBuilders).reduce(
        (acc, [key, matcherBuilder]) => {
          acc[key] = matcherBuilder('not to', condition => !condition);
          return acc;
        },
        {},
      ),
    },
  };
}

/**
 * Print an error in red and with a blank line before and after so that it
 * stands out.
 */
function printError(error) {
  console.log('\n' + format.red(error.toString()) + '\n');
}

function printIndented(string, depth = 0) {
  console.log(' '.repeat(Math.max(depth, 0) * 2) + string);
}

function describe(label, callback) {
  const frame = stack[stack.length - 1];
  const {blocks, depth} = frame;
  stack.push({
    afterHooks: [],
    beforeHooks: [],
    blocks: [],
    depth: depth + 1,
    label,
    parent: frame || null,
    type: 'suite',
  });
  callback();
  blocks.push(stack.pop());
}

async function runSuite({blocks, depth, label}) {
  printIndented(format.bold(label), depth);
  stats.suites++;
  await run(blocks);
}

function getHooks(hookType, parent) {
  let hooks = [];
  let ancestor = parent;
  while (ancestor) {
    hooks = [...ancestor[hookType], ...hooks];
    ancestor = ancestor.parent;
  }
  return hooks;
}

async function runExample({callback, depth, label, parent}) {
  printIndented(label, depth);
  stats.examples++;

  try {
    const hooks = getHooks('beforeHooks', parent);
    hooks.forEach(hook => hook());
    await callback();
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      stats.failures++;
      printError(error);
    } else {
      stats.errors++;
      printError(error.stack);
    }
  } finally {
    // Hooks may involve important teardown, so try to run them all even if
    // example didn't finish or prior hooks blew up.
    const hooks = getHooks('afterHooks', parent);
    hooks.forEach(hook => {
      try {
        hook();
      } catch (error) {
        printError(error);
      }
    });
  }
}

async function run(blocks) {
  for (const block of blocks) {
    const {type} = block;
    if (type === 'suite') {
      await runSuite(block);
    } else if (type === 'example') {
      await runExample(block);
    }
  }
}

/**
 * `context` is a synonym for `describe`.
 */
const context = describe;

function it(label, callback) {
  const frame = stack[stack.length - 1];
  const {blocks, depth} = frame;
  blocks.push({
    callback,
    depth: depth + 1,
    label,
    parent: frame,
    type: 'example',
  });
}

function pluralize(word, count) {
  const base = word.replace(/s?$/, '');
  return count === 1 ? base : `${base}s`;
}

let hasRunSuite = false;

process.on('beforeExit', async () => {
  if (!hasRunSuite) {
    hasRunSuite = true;
    const {blocks} = stack[0];
    await run(blocks);
  }
});

process.on('exit', () => {
  const summary = Object.entries(stats).map(([type, count]) => {
    return `${count} ${pluralize(type, count)}`;
  });
  console.log(format.underline(summary.join(', ')));
  process.exit(stats.failures === 0 ? 0 : 1);
});

module.exports = {
  afterEach,
  beforeEach,
  context,
  describe,
  expect,
  it,
};
