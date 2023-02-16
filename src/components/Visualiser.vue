<script setup lang="ts">
  import { withDefaults, computed, watch, ref } from 'vue';
  import type { ElementsDefinition } from 'cytoscape';

  import { createPackageGraph, type ProjectAssets, type PackageGraph, getRootPackageId } from '@/lib/packages';
  import type { PackageAdvisory } from '@/lib/advisories';
  import { compare as compareSemver } from '@/lib/semver';

  import Cytoscape from './Cytoscape.vue';

  export interface Props {
    projectAssets: ProjectAssets | null;
    advisories: PackageAdvisory[] | null;
  };

  export interface DependencySummary {
    id: string;
    name: string;
    resolvedVersion: string;
    totalVersions: number;
    advisories: PackageAdvisory[];
  };

  const COLOR_PROJECT = '#189b18';
  const COLOR_RESOLVED = '#01cbd5';
  const COLOR_UNRESOLVED = '#9d9d9d';
  const COLOR_TARGET = '#ffd507';

  const props = withDefaults(defineProps<Props>(), {
    projectAssets: null
  });

  const elementsRef = ref<ElementsDefinition | null>(null);
  const graphRef = computed(computeGraph);
  const packagesRef = computed(computePackages);

  // Clear the current dependency visualisation if the underlying graph changes
  watch(() => graphRef.value, () => elementsRef.value = null);

  function computeElements(graph: PackageGraph, packageId: string) {
    const elements: ElementsDefinition = {
      edges: [],
      nodes: []
    };

    const rootId = getRootPackageId();
    const computedPaths = new Set<string>();
    const start = graph[packageId];
    const nodeMap: { [key: string]: cytoscape.NodeDefinition } = {};
    const stack: { id: string, version: string }[] = []

    for (const version of Object.keys(start.versionRefs))
      stack.push({ id: packageId, version });

    while (stack.length > 0) {
      const next = stack.pop()!;
      const node = graph[next.id];
      const key = `${next.id}/${next.version}`;
      const parents = node.versionRefs[next.version];

      // ensure the package node exists
      let existingNode = nodeMap[next.id];

      if (existingNode == null) {
        existingNode = {
          data: {
            id: next.id,
            name: node.name,
            color: next.id === packageId ? COLOR_TARGET : COLOR_UNRESOLVED
          }
        };

        nodeMap[next.id] = existingNode;
        elements.nodes.push(existingNode);
      }

      // Update the node color depending on what type it is
      if (next.id === packageId)
        existingNode.data.color = COLOR_TARGET;
      else if (next.version === node.resolvedVersion) {
        existingNode.data.color = node.versionRefs[next.version].length === 0 
          ? COLOR_PROJECT
          : COLOR_RESOLVED;
      }

      for (const parentKey of parents) {
        const [ parentId, parentVersion ] = parentKey.split('/');

        if (!computedPaths.has(parentKey)) {
          stack.push({ id: parentId, version: parentVersion });
          computedPaths.add(parentKey);
        }

        elements.edges.push({
          data: {
            id: `${parentKey}+${key}`,
            source: parentId,
            target: next.id,
            label: next.version,
            color: parentId === rootId
              ? COLOR_PROJECT
              : (next.version === node.resolvedVersion
                ? COLOR_RESOLVED
                : COLOR_UNRESOLVED)
          }
        });
      }
    }

    return elements;
  }

  function renderDependencies(packageId: string) {
    if (graphRef.value == null)
      throw new Error('graph not initialized');
    
    elementsRef.value = computeElements(graphRef.value, packageId);
  }

  function computeGraph() {
    const assets = props.projectAssets;

    if (assets == null)
      return null;

    const keys = Object.keys(assets.projectFileDependencyGroups);

    // TODO: Allow the package graph to be selected from an available target
    //  rather than just grabbing the first.
    return createPackageGraph(assets.targets[keys[0]], {
      version: assets.project.version,
      dependencies: assets.projectFileDependencyGroups[keys[0]]
        .map(s => s.split(' ')[0])
    });
  }

  function computePackages() {
    const graph = graphRef.value;

    if (graph == null)
      return null;

    const rootPrefix = getRootPackageId() + '/';

    const packageIds = Object.keys(graph)
      .filter(pid => pid[0] !== '.') // filter out 'hidden' packages (i.e. .root)
      .sort();

    const projectDeps: DependencySummary[] = [];
    const transitiveDeps: DependencySummary[] = [];
    const advisoryDeps: DependencySummary[] = [];

    for (const packageId of packageIds) {
      const node = graph[packageId];

      const isProjectDependency = node.versionRefs[node.resolvedVersion]
          .some(id => id.indexOf(rootPrefix) === 0);

      const summary = {
        id: packageId,
        name: node.name,
        resolvedVersion: node.resolvedVersion,
        totalVersions: Object.keys(node.versionRefs).length,
        advisories: calculatePackageAdvisories(packageId, node.resolvedVersion)
      };

      (isProjectDependency ? projectDeps : transitiveDeps).push(summary);

      if (summary.advisories.length > 0)
        advisoryDeps.push(summary);
    }

    return {
      project: projectDeps,
      transitive: transitiveDeps,
      advisories: advisoryDeps
    };
  }

  function calculatePackageAdvisories(packageId: string, resolvedVersion: string): PackageAdvisory[] {
    if (props.advisories == null)
      return [];

    return props.advisories.filter(advisory => advisory.package.toLowerCase() == packageId
        && (advisory.introduced == '0' || compareSemver(advisory.introduced, resolvedVersion) <= 0)
        && (advisory.fixed == null || compareSemver(advisory.fixed, resolvedVersion) > 0)
    );
  }
</script>

<template>
  <div class="visualiser" v-if="packagesRef">
    <ul class="packages">
      <li class="headline alert">Outstanding Advisories</li>
      <li v-if="!packagesRef.advisories.length">No advisories found!</li>
      <li v-for="pkg in packagesRef.advisories" :title="pkg.advisories.map(a => a.id).join(' ')" @click.prevent="renderDependencies(pkg.id)" :class="{ advisory: pkg.advisories.length > 0 }">
        <span class="package-name">{{ pkg.name }}</span> <span class="package-version">{{ pkg.resolvedVersion }}</span> <sup class="extra-versions" v-if="pkg.totalVersions > 1">+{{ pkg.totalVersions - 1 }}</sup>
      </li>
      <li class="headline">Project Dependencies</li>
      <li v-for="pkg in packagesRef.project" :title="pkg.name" @click.prevent="renderDependencies(pkg.id)" :class="{ advisory: pkg.advisories.length > 0 }">
        <span class="package-name">{{ pkg.name }}</span> <span class="package-version">{{ pkg.resolvedVersion }}</span> <sup class="extra-versions" v-if="pkg.totalVersions > 1">+{{ pkg.totalVersions - 1 }}</sup>
      </li>
      <li class="headline">Transitive Dependencies</li>
      <li v-for="pkg in packagesRef.transitive" :title="pkg.name" @click.prevent="renderDependencies(pkg.id)" :class="{ advisory: pkg.advisories.length > 0 }">
        <span class="package-name">{{ pkg.name }}</span> <span class="package-version">{{ pkg.resolvedVersion }}</span> <sup class="extra-versions" v-if="pkg.totalVersions > 1">+{{ pkg.totalVersions - 1 }}</sup>
      </li>
    </ul>
    <Cytoscape :elements="elementsRef" class="graph" />
  </div>
</template>

<style scoped>
  .visualiser {
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%;
  }

  .graph {
    flex: 1 1 auto;
    max-height: 100%;
  }

  .packages {
    flex: 0 0 auto;
    max-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    text-overflow: ellipsis;
    padding: 1rem;
    margin: 0;
  }

  .packages li.headline {
    margin-left: 0rem;
    cursor: default;
    margin-top: 1rem;
    
    color: white;
    text-transform: uppercase;
  }

  .packages li.headline:first-child {
    margin-top: 0;
  }

  .packages li {
    list-style: none;
    margin: 0.3rem 0 0.3rem 1rem;
    padding: 0;
    position: relative;
    cursor: pointer;
  }

  .packages li.advisory::before {
    content: '!';
    position: absolute;
    font-family: 'Courier New', Courier, monospace;
    color: red;
    font-size: 1rem;
    font-weight: bold;
    left: -1rem;
  }

  .packages .package-version {
    color: #01cbd5;
  }

  .packages .extra-versions {
    vertical-align: top;
    font-size: 0.75rem;
    color: #d58a01;
  }
</style>
