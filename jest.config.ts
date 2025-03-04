const { getJestProjects } = require('@nx/jest');

export default {
  projects: [
    ...getJestProjects(),
    '<rootDir>/apps/playground',
    '<rootDir>/libs/webworker',
  ],
};
