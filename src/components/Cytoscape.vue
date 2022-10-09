<script setup lang="ts">
  import { withDefaults, ref, onMounted, watch, type VNodeRef } from 'vue';
  import cytoscape, { type ElementsDefinition } from 'cytoscape';
  import dagre from 'cytoscape-dagre';

  export interface Props {
    elements: ElementsDefinition | null;
  };

  cytoscape.use(dagre);

  const props = withDefaults(defineProps<Props>(), {
    elements: null
  });

  const nodeRef = ref<VNodeRef | null>(null);
  const cyRef = ref<cytoscape.Core | null>(null);

  watch(() => props.elements, elements => {
    if (cyRef.value != null) {
      const cy = cyRef.value;
      cy.elements().remove();

      if (elements != null) {
        cy.add(elements);

        const layout = cy.layout({
          name: 'dagre',
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true
        } as any);

        layout.run();
      }
    }
  });

  onMounted(() => {
    cyRef.value = cytoscape({
      container: nodeRef.value,
      wheelSensitivity: 0.3,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(name)',
            'background-color': 'data(color)',
            'color': 'white',
            'font-size': '0.8em',
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
            'target-arrow-shape': 'vee',
            'curve-style': 'unbundled-bezier',
            'font-size': '0.6em'
          }
        }
      ]
    });
  });
</script>

<template>
  <div ref="nodeRef"></div>
</template>