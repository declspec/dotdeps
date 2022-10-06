<template>
  <div class="dropzone" @dragover.prevent @drop="onDrop">
    <Visualiser :project-assets="projectAssets" />
  </div>
</template>

<script setup lang="ts">
  import type { ProjectAssets } from './lib/packages';
  import { ref } from 'vue';
  
  import Visualiser from './components/Visualiser.vue';

  const projectAssets = ref<ProjectAssets | null>(null);

  function onDrop(e: DragEvent) {
    e.preventDefault();

    if (e.dataTransfer?.items != null) {
      Array.prototype.forEach.call(e.dataTransfer.items, async (item: DataTransferItem) => {
        if (item.kind === 'file') {
          const file = item.getAsFile()!;
          const json = await file.text();

          const assets = JSON.parse(json) as ProjectAssets;
          projectAssets.value = assets;
        }
      });
    }
  }
</script>

<style scoped>
  .dropzone {
    width: 100vw;
    height: 100vh;
  }
</style>
