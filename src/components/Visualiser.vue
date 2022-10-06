<script setup lang="ts">
  import { withDefaults, computed, onMounted, watch, ref, type VNodeRef } from 'vue';
  import cytoscape, { type ElementsDefinition } from 'cytoscape';
  import * as dagre from 'cytoscape-dagre';

  import { createPackageGraph, type ProjectAssets, type PackageGraph } from '@/lib/packages';
  import { compare as compareSemver } from '@/lib/semver';

  export interface Props {
    projectAssets: ProjectAssets | null
  };

  const props = withDefaults(defineProps<Props>(), {
    projectAssets: null
  });

  const elRef = ref<VNodeRef | null>(null);
  const cyRef = ref<cytoscape.Core | null>(null);

  const graphRef = computed(() => {
    const assets = props.projectAssets;

    if (assets == null)
      return null;

    const targetKeys = Object.keys(assets.targets);
    return createPackageGraph(assets.targets[targetKeys[0]]);
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
      userZoomingEnabled: false,
      style: [
        { 
          selector: 'node',
          style: {
            'label': 'data(name)',
            'background-color': 'data(color)',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#ccc',
            'target-arrow-color': '#000',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ]
    });
  });

  // Clear the current dependency visualisation if the underlying graph changes
  watch(() => graphRef.value, () => cyRef.value?.elements().remove());

  function renderDependencies(packageId: string, packageVersion: string) {
    if (cyRef.value == null)
      throw new Error('cytoscape not initialized');

    if (graphRef.value == null)
      throw new Error('graph not initialized');

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

    cy.elements().remove();
    cy.add(elements);

    const layout = cy.layout({
      name: 'breadthfirst',
      directed: true,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true
    } as any);

    layout.run();
    cy.resize();
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
