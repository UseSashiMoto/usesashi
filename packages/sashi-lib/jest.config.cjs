/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "moduleFileExtensions": [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "node"
    ],
    "transformIgnorePatterns": [
        "/node_modules/",
        "\\.pnp\\.[^\\\/]+$",
        '<rootDir>/node_modules/',
    ]
};
