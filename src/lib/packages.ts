export type PackageId = string;
export type PackageKey = string;
export type VersionNumber = string;

export interface ProjectAssets {
  projectFileDependencyGroups: {
    [key: string]: string[];
  }
  targets: {
    [key: string]: ResolvedPackageHash;
  },
  project: {
    version: string;
    restore: {
      projectName: string;
    },
    frameworks: {
      [tfm: string]: {
        targetAlias: string;
        dependencies: {
          [key: string]: {
            version: string;
          }
        }
      }
    }
  }
};

export interface ResolvedPackageHash {
  [key: PackageKey]: ResolvedPackage
};

export interface ResolvedPackage {
  type: 'package' | 'project';
  dependencies?: {
    [key: PackageId]: VersionNumber
  };
};

export interface PackageNode {
  name: string;
  version: VersionNumber;
  dependencies: PackageReference[];
  references: PackageReference[];
};

export interface PackageReference {
  id: PackageId;
  versionRange: string;
}

export interface PackageGraph {
  [key: PackageId]: PackageNode
};

export interface Project {
  version: string;
  dependencies: string[];
}

export function getPackageId(packageName: string) {
  return packageName.toLowerCase();
}

export function createPackageGraph(projectId: string, projectName: string, assets: ProjectAssets, targetFramework: string): PackageGraph {
  // TODO: Actually do TFM lookup / parsing
  const project = assets.project;
  const frameworkName = Object.keys(assets.targets)[0];
  const target = assets.targets[frameworkName];
  const framework = project.frameworks[Object.keys(project.frameworks)[0]];
  
  // Create a graph by traversing the top level resolved packages and
  //  determining where they are referenced from
  const graph: PackageGraph = {};
  const projectNode = getOrAddGraphNode(graph, projectId, projectName);

  for (const [ packageName, ref ] of Object.entries(framework.dependencies)) {
    projectNode.dependencies.push({
      id: getPackageId(packageName),
      versionRange: normalizeVersionRange(ref.version)
    });
  }

  for (const [packageKey, pkg] of Object.entries(target)) {
    const [packageName, packageVersion] = packageKey.split('/');
    const packageId = getPackageId(packageName);
    const packageNode = getOrAddGraphNode(graph, packageId, packageName);
    packageNode.version = packageVersion; // this is the canonical version, override any placeholder version

    // If it's a project reference, add it as a direct dependency of the project node
    if (pkg.type === 'project' && !projectNode.dependencies.some(d => d.id === packageId)) {
      const normalizedVersion = normalizeVersionRange(`[${packageVersion}]`);
      projectNode.dependencies.push({ id: packageId, versionRange: normalizedVersion });
    }

    // Check if there is a direct project reference to the current package
    const projectRef = projectNode.dependencies.find(dep => dep.id === packageId);

    if (projectRef != null) {
      packageNode.references.push({ id: projectId, versionRange: projectRef.versionRange });
    }

    if (pkg.dependencies != null) {
      for (const [depName, depVersionRange] of Object.entries(pkg.dependencies)) {
        const depId = getPackageId(depName);
        const depNode = getOrAddGraphNode(graph, depId, depName);
        const normalizedVersion = normalizeVersionRange(depVersionRange);

        depNode.references.push({ id: packageId, versionRange: normalizedVersion });
        packageNode.dependencies.push({ id: depId, versionRange: normalizedVersion });
      }
    }
  }

  return graph;
}

// Convert NuGet version ranges into something more readable
//  ref: https://learn.microsoft.com/en-us/nuget/concepts/package-versioning?tabs=semver20sort#version-ranges
function normalizeVersionRange(rawVersionRange: string) {
  const [lower,upper] = rawVersionRange.replace(/\s+/g, '').split(',');
  const ranges: string[] = [];

  // check for exact version match
  if (upper == null && lower.startsWith('[') && lower.endsWith(']'))
    return `= ${lower.substring(1, lower.length - 1)}`;

  if (lower.length > 1) {
    let inclusive = true;
    let offset = 0;

    if (lower[0] === '(' || lower[0] === '[') {
        inclusive = lower[0] !== '(';
        ++offset;
    }

    ranges.push(`${inclusive ? '>=' : '>'} ${lower.substring(offset)}`);
  }

  if (upper != null && upper.length > 1) {
    ranges.push(`${upper[upper.length - 1] === ')' ? '<' : '<='} ${upper.substring(0, upper.length - 1)}`);
  }
  
  return ranges.join(', ');
}

function getOrAddGraphNode(graph: PackageGraph, packageId: string, packageName: string): PackageNode {
  return graph[packageId] || (graph[packageId] = {
    name: packageName,
    version: '0.0.0',
    dependencies: [],
    references: []
  });
}
