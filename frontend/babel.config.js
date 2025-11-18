// E:\3720Deploy\frontend\babel.config.js
// Use ES Module syntax (export default) since package.json has "type": "module"

export default {
    presets: [
        '@babel/preset-env',
        // CRITICAL FIX FOR JSX
        '@babel/preset-react',
        ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
    ],
};