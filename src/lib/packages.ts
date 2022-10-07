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
  resolvedVersion: VersionNumber;
  versionRefs: {
    [key: VersionNumber]: PackageKey[]
  }
};

export interface PackageGraph {
  [key: PackageId]: PackageNode
};

export interface Project {
  name: string;
  version: string;
  dependencies: string[];
}

export function createPackageGraph(resolvedPackages: ResolvedPackageHash, project: Project) {
  // Create a graph by traversing the top level resolved packages and
  //  determining where they are referenced from
  const graph: PackageGraph = {};

  const projectKey = `${project.name.toLowerCase()}/${project.version}`;
  const projectDependencyIds = project.dependencies.map(d => d.toLowerCase());

  const projectNode = getOrAddGraphNode(graph, project.name);
  getOrAddPackageVersion(projectNode, project.version);
  projectNode.resolvedVersion = project.version;

  for (const [packageKey, pkg] of Object.entries(resolvedPackages)) {
    const [packageName, packageVersion] = packageKey.split('/');

    const packageNode = getOrAddGraphNode(graph, packageName);
    const versionRefs = getOrAddPackageVersion(packageNode, packageVersion);
    packageNode.resolvedVersion = packageVersion;

    if (projectDependencyIds.some(d => d === packageName.toLowerCase()))
      versionRefs.push(projectKey);

    if (pkg.dependencies != null) {
      for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
        // NOTE: Not comprehensive sanitisation
        const sanitisedVersion = depVersion.trim().replace(/^\[|\]$/g, '');
        console.log(depVersion, sanitisedVersion);
        const depRefs = getOrAddPackageVersion(getOrAddGraphNode(graph, depName), sanitisedVersion);
        depRefs.push(packageKey.toLowerCase());
      }
    }
  }

  return graph;
}

function getOrAddGraphNode(graph: PackageGraph, packageName: string) {
  const graphKey = packageName.toLowerCase();

  return graph[graphKey] || (graph[graphKey] = {
    name: packageName,
    resolvedVersion: '<unknown>',
    versionRefs: {}
  });
}

function getOrAddPackageVersion(packageNode: PackageNode, version: VersionNumber) {
  return packageNode.versionRefs[version]
    || (packageNode.versionRefs[version] = []);
}