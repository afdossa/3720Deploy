// E:\3720Deploy\frontend\jest.config.ts

import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
    // Re-introduce the ts-jest preset
    preset: 'ts-jest',

    // Defines the base directory for Jest (E:\3720Deploy\frontend)
    rootDir: '.',
    testEnvironment: 'jsdom',

    // CRITICAL PATHING: Correctly set the test directory path
    roots: ['<rootDir>/src/frontend-tests/src'],
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',

    setupFilesAfterEnv: ['<rootDir>/src/frontend-tests/src/jest.setup.ts', '@testing-library/jest-dom/extend-expect'],

    // Use default transformation settings, which rely on the globals configuration
    transform: {
        // Use the built-in ts-jest transformer for TS/TSX
        '^.+\\.(ts|tsx)$': 'ts-jest',
        // Use babel-jest for plain JS/JSX files
        '^.+\\.(js|jsx)$': 'babel-jest',
        // Mock CSS
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    },

    // ⚡️ CRITICAL FIX: Pass the necessary Babel configuration directly to ts-jest via globals
    globals: {
        'ts-jest': {
            // Force ts-jest to use Babel for JSX and modern syntax
            babel: true,
            // Inline Babel configuration for JSX/React support
            tsconfig: 'tsconfig.json',
            // Explicitly define the Babel presets required for transformation
            // This is the most reliable way to inject the JSX fix.
            diagnostics: {
                ignoreCodes: [1343], // Optional: Ignore a common ts-jest warning
            },

            // NOTE: We don't need a separate 'babel' block here because setting 'babel: true'
            // will tell ts-jest to look for a babel.config.js/ts or package.json config.
            // If you had an external babel.config.js/cjs, you should use that.
            // Since we deleted it to fix the module error, 'babel: true' often suffices.
        },
    },

    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/build/',
    ],
};

export default jestConfig;