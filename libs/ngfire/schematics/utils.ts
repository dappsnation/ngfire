import { Tree, SchematicsException, SchematicContext } from '@angular-devkit/schematics';

export interface WorkspaceProject {
  root: string;
  sourceRoot?: string;
  projectType?: string;
  architect?: Record<string, {
    builder: string;
    options?: Record<string, any>,
    configurations?: Record<string, Record<string, any>>,
    defaultConfiguration?: string,
  }>;
}

export interface Workspace {
  defaultProject?: string;
  projects: Record<string, WorkspaceProject>;
}

///////////////
// WORKSPACE //
///////////////

export function getWorkspace(host: Tree): { path: string; workspace: Workspace } {
  const path = '/angular.json';

  const configBuffer = path && host.read(path);
  if (!configBuffer) {
    throw new SchematicsException(`Could not find angular.json`);
  }

  const workspace = JSON.parse(configBuffer.toString()) as Workspace|undefined;
  if (!workspace) {
    throw new SchematicsException('Could not parse angular.json');
  }

  return {
    path,
    workspace
  };
}

export const getProject = (workspace: Workspace, projectName = workspace.defaultProject) => {

  if (!projectName) {
    throw new SchematicsException(
      'No Angular project selected and no default project in the workspace'
    );
  }

  const project = workspace.projects[projectName];
  if (!project) {
    throw new SchematicsException(
      'The specified Angular project is not defined in this workspace'
    );
  }

  if (project.projectType !== 'application') {
    throw new SchematicsException(
      `Deploy requires an Angular project type of "application" in angular.json`
    );
  }

  return { project, projectName };
};



//////////////
// PACKAGES //
//////////////
export function safeReadJSON(path: string, tree: Tree) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return JSON.parse(tree.read(path)!.toString());
  } catch (e: any) {
    throw new SchematicsException(`Error when parsing ${path}: ${e.message}`);
  }
}

export const stringifyFormatted = (obj: any) => JSON.stringify(obj, null, 2);

export const addDependencies = (
  host: Tree,
  deps: { [name: string]: { dev?: boolean, version: string } },
  context: SchematicContext
) => {
  const packageJson = host.exists('package.json') && safeReadJSON('package.json', host);

  if (packageJson === undefined) {
    throw new SchematicsException('Could not locate package.json');
  }

  if (!packageJson.devDependencies) packageJson.devDependencies = {};
  if (!packageJson.dependencies) packageJson.dependencies = {};

  Object.keys(deps).forEach(depName => {
    const dep = deps[depName];
    const existingDeps = dep.dev ? packageJson.devDependencies : packageJson.dependencies;
    const existingVersion = existingDeps[depName];
    if (!existingVersion) {
      existingDeps[depName] = dep.version;
    } else {
      context.logger.log('info', `package "${depName}" already installed with version ${existingVersion}. No change applied.`)
    }
  });

  // Overwrite package.json
  const path = 'package.json';
  const content = JSON.stringify(packageJson, null, 2);
  if (host.exists(path)) {
    host.overwrite(path, content);
  } else {
    host.create(path, content);
  }
};