export type PackageName = string;
export type PackageId = string;
export type VersionNumber = string;

export interface ProjectAssets {
    version: string;
    targets: {
        [key: string]: ResolvedPackageHash
    }
};

export interface ResolvedPackageHash {
    [key: PackageId]: ResolvedPackage
};

export interface ResolvedPackage {
    type: "package" | "project";
    dependencies?: {
        [key: PackageName]: VersionNumber
    };
};

export interface PackageNode {
    name: string;
    resolvedVersion: string;
    versionRefs: {
        [key: VersionNumber]: PackageId[]
    }
};

export interface PackageGraph {
    [key: PackageName]: PackageNode
};

export function createPackageGraph(resolvedPackages: ResolvedPackageHash) {
    // Create a graph by traversing the top level resolved packages and
    //  determining where they are referenced from
    const graph: PackageGraph = {};

    for (const [ packageKey, pkg ] of Object.entries(resolvedPackages)) {
        const [ packageName, packageVersion ] = packageKey.split('/');

        const packageNode = getOrAddGraphNode(graph, packageName);
        packageNode.resolvedVersion = packageVersion;
        getOrAddPackageVersion(packageNode, packageVersion);

        if (pkg.dependencies != null) {
            for (const [ depName, depVersion ] of Object.entries(pkg.dependencies)) {
                const versionRefs = getOrAddPackageVersion(getOrAddGraphNode(graph, depName), depVersion);
                versionRefs.push(packageKey.toLowerCase());
            }
        }
    }

    return graph;
}

export function computeDependencyChains(packageGraph: PackageGraph, packageId: PackageId) {
    return traverse([ ], packageGraph, packageId);

    function traverse(chain: PackageId[], packageGraph: PackageGraph, packageId: PackageId) {
        const [ packageKey, packageVersion ] = packageId.split('/');

        const versionRefs = packageGraph[packageKey]
            .versionRefs[packageVersion];

        if (versionRefs.length === 0) 
            return [ chain ];

        return versionRefs.reduce((chains, parentId) => {
            const clone = chain.slice();
            clone.push(parentId);
            Array.prototype.push.apply(chains, traverse(clone, packageGraph, parentId));
            return chains;
        }, []);
    }
}

function getOrAddGraphNode(graph: PackageGraph, packageName: PackageName) {
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