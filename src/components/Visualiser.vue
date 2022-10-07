<script setup lang="ts">
  import { withDefaults, computed, onMounted, watch, ref, type VNodeRef } from 'vue';
  import cytoscape, { type ElementsDefinition } from 'cytoscape';
  import * as dagre from 'cytoscape-dagre';

  import { createPackageGraph, type ProjectAssets, type PackageGraph } from '@/lib/packages';
  import { compare as compareSemver } from '@/lib/semver';

  export interface Props {
    projectAssets: ProjectAssets | null
  };

  const COLOR_PROJECT = '#ffd507';
  const COLOR_RESOLVED = '#01cbd5';
  const COLOR_UNRESOLVED = '#9d9d9d';

  const props = withDefaults(defineProps<Props>(), {
    projectAssets: null
  });

  const elRef = ref<VNodeRef | null>(null);
  const cyRef = ref<cytoscape.Core | null>(null);

  const graphRef = computed(() => {
    const assets = props.projectAssets;

    if (assets == null)
      return null;

    const keys = Object.keys(assets.projectFileDependencyGroups);

    return createPackageGraph(assets.targets[keys[0]], {
      name: 'Project',
      version: '1.0.0',
      dependencies: assets.projectFileDependencyGroups[keys[0]]
        .map(s => s.split(' ')[0])
    });
  });

  const packagesRef = computed(() => {
    const graph = graphRef.value;

    if (graph == null)
      return null;

    const packageIds = Object.keys(graph)
      .sort();

    return packageIds.map(id => {
      const node = graph[id];

      return {
        id,
        name: node.name,
        resolvedVersion: node.resolvedVersion,
        otherVersions: Object.keys(node.versionRefs)
          .filter(v => v !== node.resolvedVersion)
          .sort(compareSemver)
      };
    })
  })

  onMounted(() => {
    cytoscape.use(dagre);

    cyRef.value = cytoscape({
      container: elRef.value,
      userZoomingEnabled: true,
      style: [
        { 
          selector: 'node',
          style: {
            'label': 'data(name)',
            'background-color': 'data(color)',
            'color': 'white',
            'font-size': '0.8em'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'label': 'data(label)',
            'color': 'white',
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'unbundled-bezier',
            'font-size': '0.6em'
          }
        }
      ]
    });
  });

  // Clear the current dependency visualisation if the underlying graph changes
  watch(() => graphRef.value, () => cyRef.value?.elements().remove())

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

      console.log('parents', parents);

      // ensure the package node exists
      let existingNode = nodeMap[next.id];

      if (existingNode == null) {
        existingNode = nodeMap[next.id] = {
          data: {
            id: next.id,
            name: node.name,
            color: COLOR_UNRESOLVED
          }
        };

        elements.nodes.push(existingNode);
      }

      // Update the node color if any paths are pointing to the resolved version
      console.log(next, node);
      if (next.version === node.resolvedVersion) {
        existingNode.data.color = node.versionRefs[next.version].length === 0 
          ? COLOR_PROJECT
          : COLOR_RESOLVED;
      }

      for (const parentKey of parents) {
        const [ parentId, parentVersion ] = parentKey.split('/');
        //const parentNode = graph[parentId];

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
            color: next.version === node.resolvedVersion
              ? COLOR_RESOLVED
              : COLOR_UNRESOLVED
          }
        });
      }
    }

    console.log(elements);
    return elements;
  }

  function renderDependencies(packageId: string, packageVersion: string) {
    if (cyRef.value == null)
      throw new Error('cytoscape not initialized');

    if (graphRef.value == null)
      throw new Error('graph not initialized');

    const cy = cyRef.value;
    const elements = computeElements(graphRef.value, packageId, packageVersion);
/*
    const graph = graphRef.value;
    const cy = cyRef.value;

    const node = graph[packageId];
    const versionRefs = [ [ packageId, node.versionRefs[packageVersion] ] ];

    const elements: ElementsDefinition = { 
      nodes: [], 
      edges: []
    };

    // Add the starting node
    elements.nodes.push({
      data: {
        id: packageId,
        name: node.name,
        color: 'red'
      }
    });

    while (versionRefs.length > 0) {
      const [ packageId, refs ] = versionRefs.pop()!;

      for (const parentKey of refs) {
        const [ parentId, parentVersion ] = parentKey.split('/');
        const parentNode = graph[parentId];

        versionRefs.push([ parentId, parentNode.versionRefs[parentVersion] ]);

        if (!elements.nodes.some(n => n.data.id === parentId)) {
          elements.nodes.push({
            data: {
              id: parentId,
              name: graph[parentId].name,
              color: parentNode.versionRefs[parentVersion].length === 0 ? 'green' : '#ccc'
            }
          });
        }
        
        if (!elements.edges.some(e => e.data.source === packageId && e.data.target === parentId)) {
          elements.edges.push({
            data: {
              id: `${packageId}+${parentId}`,
              source: parentId,
              target: packageId as string
            }
          });
        }
      }
    }

    elements.nodes.reverse();
*/
    cy.elements().remove();
    cy.add(elements);

    const layout = cy.layout({
      name: 'dagre',
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
      
    } as any);

    layout.run();
  }
</script>

<template>
  <div class="visualiser">
    <ul class="packages">
      <li v-for="pkg in packagesRef" :title="pkg.name">
        {{ pkg.name }}<br/>
        <a href="" @click.prevent="renderDependencies(pkg.id, pkg.resolvedVersion)">{{ pkg.resolvedVersion }}</a>
        <template v-if="pkg.otherVersions.length > 0">
          &nbsp; | &nbsp;
          <a href="" 
            v-for="version in pkg.otherVersions" 
            @click.prevent="renderDependencies(pkg.id, version)"
          >{{ version }}</a>
        </template>
      </li>
    </ul>
    <div class="graph" ref="elRef"></div>
  </div>
</template>

<style scoped>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .visualiser {
    display: flex;
    flex-direction: row;
    height: 100vh;
    width: 100vw;
  }

  .graph {
    flex: 1;
    max-height: 100vh;
  }

  .packages {
    width: 30%;
    flex: 0 0 auto;
    max-height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
