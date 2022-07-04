const { getJestProjects } = require('@nrwl/jest');

export default {
  projects: [
    ...getJestProjects(),
    '<rootDir>/apps/playground',
    '<rootDir>/libs/webworker',
  ],
};
