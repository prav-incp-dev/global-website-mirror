import { join } from 'path'

const now = new Date()
const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-')

export default {
  packageManager: 'npm',
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vite.config.js',
    related: true,
  },
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  mutate: ['src/**/*.js', '!src/generated/**'],
  mutator: {
    // excludedMutations: ['StringLiteral'],
  },
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: join('coverage', 'mutation', timestamp, 'index.html'),
  },
  tempDirName: join('coverage', 'mutation', 'stryker-tmp'),
  cleanTempDir: true,
  concurrency: 4,
  timeoutMS: 30000,
}
