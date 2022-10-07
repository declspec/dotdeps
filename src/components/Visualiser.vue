<script setup lang="ts">
  import { withDefaults, computed, watch, ref } from 'vue';
  import type { ElementsDefinition } from 'cytoscape';

  import { createPackageGraph, type ProjectAssets, type PackageGraph } from '@/lib/packages';
  import Cytoscape from './Cytoscape.vue';

  export interface Props {
    projectAssets: ProjectAssets | null
  };

  const COLOR_PROJECT = '#189b18';
  const COLOR_RESOLVED = '#01cbd5';
  const COLOR_UNRESOLVED = '#9d9d9d';
  const COLOR_TARGET = '#ffd507';

  const props = withDefaults(defineProps<Props>(), {
    projectAssets: null
  });

  const elementsRef = ref<ElementsDefinition | null>(null);

  const graphRef = computed(() => {
    const assets = props.projectAssets;

    if (assets == null)
      return null;

    const keys = Object.keys(assets.projectFileDependencyGroups);

    return createPackageGraph(assets.targets[keys[0]], {
      name: '.root',
      version: assets.project.version,
      dependencies: assets.projectFileDependencyGroups[keys[0]]
        .map(s => s.split(' ')[0])
    });
  });

  const packagesRef = computed(() => {
    const graph = graphRef.value;

    if (graph == null)
      return null;

    const packageIds = Object.keys(graph)
      .filter(pid => pid[0] !== '.') // filter out 'hidden' packages (i.e. .root)
      .sort();

    const packages = packageIds.map(id => {
      const node = graph[id];

      return {
        id,
        name: node.name,
        resolvedVersion: node.resolvedVersion,
        totalVersions: Object.keys(node.versionRefs).length,
        // TODO: Make this more robust, '.root' was just a name I came up with
        isProjectDependency: node.versionRefs[node.resolvedVersion]
          .some(id => id.indexOf('.root/') === 0),
      };
    });

    return packages.sort((p1, p2) => {
      return p1.isProjectDependency == p2.isProjectDependency
        ? p1.name.localeCompare(p2.name)
        : (p1.isProjectDependency ? -1 : 1);
    });
  });

  // Clear the current dependency visualisation if the underlying graph changes
  watch(() => graphRef.value, () => elementsRef.value = null);

  function computeElements(graph: PackageGraph, packageId: string) {
    const elements: ElementsDefinition = {
      edges: [],
      nodes: []
    };

    const computedPaths = new Set<string>();
    const start = graph[packageId];
    const nodeMap: { [key: string]: cytoscape.NodeDefinition } = {};
    const stack: { id: string, version: string }[] = []// = [ { id: packageId, version: packageVersion } ];

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
            color: parentId === '.root'
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
</script>

<template>
  <div class="visualiser" v-if="packagesRef">
    <ul class="packages">
      <li v-for="pkg in packagesRef" :title="pkg.name" :class="{ 'project': pkg.isProjectDependency }" @click.prevent="renderDependencies(pkg.id)">
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
    padding: 1rem 1.5rem 1rem;
    margin: 0;
  }

  .packages li {
    list-style: none;
    margin: 0.3rem 0;
    padding: 0;
    position: relative;
    cursor: pointer;
  }

  .packages li.project::before {
    content: 'P';
    position: absolute;
    font-family: 'Courier New', Courier, monospace;
    color: #189b18;
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
