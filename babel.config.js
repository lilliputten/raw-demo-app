/** @module babel.config
 *  @description Babel configuration
 *  @since 2019.03.06, 12:00
 *  @changed 2021.08.13, 12:18
 */

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: 3,
        forceAllTransforms: true,
        loose: true,
      },
    ],
    ['@babel/preset-react'],
    // ['@babel/preset-flow'],
  ],
  // plugins: [
  //   // NOTE: 2021.08.13, 12:41 -- Settings were forcibly added after the failed build and reinstalled dependencies.
  //   ["@babel/plugin-proposal-private-methods", { loose: false }],
  //   ["@babel/plugin-proposal-private-property-in-object", { loose: false }],
  //   "@babel/plugin-transform-runtime",
  //   "@babel/plugin-proposal-class-properties",
  //   "@babel/plugin-transform-arrow-functions",
  //   "@babel/plugin-proposal-optional-chaining",
  //   "@babel/plugin-proposal-export-default-from", // Single-line export syntax
  //   "@babel/plugin-syntax-export-namespace-from", // Singlie-line reexport as namespace -- https://www.npmjs.com/package/@babel/plugin-syntax-export-namespace-from
  // ],
};
