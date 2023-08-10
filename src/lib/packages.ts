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
  type: "package" | "project";
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

export function getRootPackageId() {
  return '.root';
}

export function createPackageGraph(assets: ProjectAssets, targetFramework: string): PackageGraph {
  // TODO: Actually do TFM lookup / parsing
  const project = assets.project;
  const frameworkName = Object.keys(assets.targets)[0];
  const projectFileDependencyGroups = assets.projectFileDependencyGroups[frameworkName];
  const target = assets.targets[frameworkName];
  const framework = project.frameworks[Object.keys(project.frameworks)[0]];
  
  // Create a graph by traversing the top level resolved packages and
  //  determining where they are referenced from
  const graph: PackageGraph = {};

  const rootId = getRootPackageId();
  const projectNode = getOrAddGraphNode(graph, rootId);

  for (const [ packageName, ref ] of Object.entries(framework.dependencies)) {
    projectNode.dependencies.push({
      id: packageName.toLowerCase(),
      versionRange: ref.version.replace(/\s+/g, '')
    });
  }

  // NOTE: This is a big kludge to pick up the project dependencies since
  //  for some reason the projectFileDependencyGroups uses a different format to the rest of the version ranges
  for (const dependencyString of projectFileDependencyGroups) {
    const parts = dependencyString.split(/\s+/g);
    const depId = parts[0].toLowerCase();
    
    if (!projectNode.dependencies.some(d => d.id === depId)) {
      projectNode.dependencies.push({ id: depId, versionRange: parts[parts.length - 1]});
    }
  }
  
  for (const [packageKey, pkg] of Object.entries(target)) {
    const [packageName, packageVersion] = packageKey.split('/');
    const packageId = packageName.toLowerCase();

    const packageNode = getOrAddGraphNode(graph, packageName);
    packageNode.version = packageVersion; // this is the canonical version, override any placeholder version

    // Check if there is a direct project reference to the current package
    const projectRef = projectNode.dependencies.find(dep => dep.id === packageId);

    if (projectRef != null) {
      packageNode.references.push({ id: rootId, versionRange: projectRef.versionRange });
    }

    if (pkg.dependencies != null) {
      for (const [depName, depVersionRange] of Object.entries(pkg.dependencies)) {
        const depNode = getOrAddGraphNode(graph, depName);
        depNode.references.push({ id: packageId, versionRange: depVersionRange });
        packageNode.dependencies.push({ id: depName.toLowerCase(), versionRange: depVersionRange });
      }
    }
  }

  return graph;
}

function getOrAddGraphNode(graph: PackageGraph, packageName: string): PackageNode {
  const graphKey = packageName.toLowerCase();

  return graph[graphKey] || (graph[graphKey] = {
    name: packageName,
    version: '0.0.0',
    dependencies: [],
    references: []
  });
}
