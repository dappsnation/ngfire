import { getWorkspacePath, joinPathFragments, names, readJson, getWorkspaceLayout, Tree } from '@nrwl/devkit';
import type { Workspace, TargetConfiguration, ProjectConfiguration as NxProjectConfig } from '@nrwl/devkit';

export interface BuilderConfiguration extends Omit<TargetConfiguration, 'executor'> {
  executor?: string;
  builder?: string;
}

// Project with angular config
interface ProjectConfig extends NxProjectConfig {
  architect: Record<string, BuilderConfiguration>
}

export interface ProjectOptions {
  isAngular: boolean;
  project: string;
  projectRoot: string;
  projectConfig?: ProjectConfig;
  projectConfigLocation?: string;
}

export function readRawWorkspaceJson(tree: Tree) {
  const path = getWorkspacePath(tree);
  if (!path) throw new Error('No file angular.json or workspace.json found');
  if (!tree.exists(path)) throw new Error(`No file ${path} found`);
  return readJson<Workspace>(tree, path);
}

export function getProjectOptions(tree: Tree, projectName?: string): ProjectOptions {
  const workspacePath = getWorkspacePath(tree);
  if (!workspacePath) throw new Error('No workspace found. Should be either "angular.json" or "workspace.json"')
  const isAngular = workspacePath === '/angular.json';
  const workspace = readRawWorkspaceJson(tree);
  const project = projectName ? names(projectName).fileName : workspace.defaultProject;
  if (!project) throw new Error('No project provided');
  const config = workspace.projects[project];
  const projectRoot = `${getWorkspaceLayout(tree).libsDir}/${project}`;
  if (!config) return { isAngular, project, projectRoot };
  // project.json
  if (typeof config === 'string') {
    const projectConfigLocation = joinPathFragments(config, 'project.json');
    const projectConfig = readJson(tree, projectConfigLocation);
    return {
      isAngular,
      project,
      projectRoot: config,
      projectConfig,
      projectConfigLocation: projectConfigLocation,
    }
  } else {
    // workspace.json or angular.json
    return {
      isAngular,
      project,
      projectRoot: config.root,
      projectConfig: config as ProjectConfig,
      projectConfigLocation: workspacePath
    }
  }
}
