import { Rule, SchematicContext, Tree, apply, url, applyTemplates, chain, mergeWith, move } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { normalize } from 'path';
import { addDependencies, getProject, getWorkspace } from '../utils';
import { SchemaOptions } from './schema';



// Just return the tree
export function ngAdd(options: SchemaOptions): Rule {
  return (tree: Tree, context: SchematicContext) => {
    addDependencies(tree, {
      ngfire: { version: '0.0.12' },
      firebase: { version: '^9.2.0' },
      'firebase-tools': { dev: true, version: '^10.0.0' },
    }, context);
    context.addTask(new NodePackageInstallTask());

    const { workspace } = getWorkspace(tree);
    const { project } = getProject(workspace, options.project);

    const templateSource = apply(url('./files'), [
      applyTemplates({
        firebaseProject: options.firebaseProject || 'demo-project',
        outputPath: project.architect?.build?.options?.outputPath
      }),
      move(normalize(options.path || '.'))
    ]);

    return chain([
      mergeWith(templateSource)
    ]);
  };
}