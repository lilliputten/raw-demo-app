/** @module babel.config
 *  @description Babel configuration
 *  @since 2023.03.21, 13:26
 *  @changed 2023.03.21, 13:26
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
  ],
};
