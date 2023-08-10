<script setup lang="ts">
  import { withDefaults, computed } from 'vue';
  import type { ElementsDefinition } from 'cytoscape';

  import { type PackageGraph, getRootPackageId } from '@/lib/packages';

  import Cytoscape from './Cytoscape.vue';

  export interface Props {
    graph: PackageGraph | null;
    packageId: string | null;
  };

  const COLOR_PROJECT = '#189b18';
  const COLOR_RESOLVED = '#046298';
  const COLOR_UNRESOLVED = '#575757';
  const COLOR_TARGET = '#ffd507';

  const props = withDefaults(defineProps<Props>(), {
    graph: null,
    packageId: null
  });

  const elementsRef = computed(computeElements);

  function computeElements(): ElementsDefinition | null {
    const graph = props.graph;
    const packageId = props.packageId;

    if (graph == null || packageId == null)
      return null;

    const elements: ElementsDefinition = {
      edges: [],
      nodes: []
    };

    const rootId = getRootPackageId();
    const computedPaths = new Set<string>();
    const nodeMap: { [key: string]: cytoscape.NodeDefinition } = {};
    const stack: string[] = [ packageId ];

    while (stack.length > 0) {
      const next = stack.pop()!;
      const node = graph[next];
      //const key = `${next.id}/${next.version}`;
      //const parents = node.versionRefs[next.version];

      // ensure the package node exists
      let existingNode = nodeMap[next];

      if (existingNode == null) {
        existingNode = {
          data: {
            id: next,
            name: node.name,
            color: next === packageId 
              ? COLOR_TARGET 
              : (next === rootId 
                ? COLOR_PROJECT 
                : (node.references.some(r => r.id === rootId) ? COLOR_RESOLVED : COLOR_UNRESOLVED))
          }
        };

        nodeMap[next] = existingNode;
        elements.nodes.push(existingNode);
      }

      // Update the node color depending on what type it is
       /*
      if (next === packageId)
        existingNode.data.color = COLOR_TARGET;
       
      else if (next.version === node.resolvedVersion) {
        existingNode.data.color = node.versionRefs[next.version].length === 0 
          ? COLOR_PROJECT
          : COLOR_RESOLVED;
      }*/

      for (const ref of node.references) {
        if (!computedPaths.has(ref.id)) {
          stack.push(ref.id);
          computedPaths.add(ref.id);
        }

        elements.edges.push({
          data: {
            id: `${ref.id}+${next}`,
            source: ref.id,
            target: next,
            label: ref.versionRange,
            color: ref.id === rootId
              ? COLOR_PROJECT
              : COLOR_RESOLVED
          }
        });
      }
    }

    return elements;
  }
</script>

<template>
  <Cytoscape v-if="elementsRef" :elements="elementsRef" class="graph" />
</template>