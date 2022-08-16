import { SchemaOptions } from './schema';
import { Tree, addDependenciesToPackageJson, convertNxGenerator, names, offsetFromRoot, formatFiles, generateFiles } from '@nrwl/devkit';
import { getProjectOptions, ProjectOptions } from './utils';
import { join } from 'path';


export async function addFiles(tree: Tree, options: SchemaOptions & ProjectOptions, dirname: string) {
  const templateOptions = {
    ...options,
    ...names(options.project),
    offset: offsetFromRoot(options.projectRoot),
    template: ''
  };
  generateFiles(
    tree,
    join(dirname, 'files'),
    options.path,
    templateOptions
  );
  await formatFiles(tree);
}


// Just return the tree
export async function nxGenerator(tree: Tree, options: SchemaOptions) {
  const projectOptions = getProjectOptions(tree, options.project);
  const allOptions = {...projectOptions, ...options};
  await addFiles(tree, allOptions, __dirname);
  const installTask = addDependenciesToPackageJson(tree, {
    ngfire: "0.0.48",
    firebase: "9.9.0",
  }, {
    'firebase-tools': "11.7.0",
  });
  return installTask;
}


export const ngSchematic = convertNxGenerator(nxGenerator);
