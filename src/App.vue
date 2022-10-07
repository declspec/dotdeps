<template>
  <div class="main">
    <nav class="header">
      <h3>.NET Dependency Visualiser</h3>
    </nav>
    <div class="content" @dragover.prevent @drop="onDrop">
      <Visualiser :project-assets="projectAssets" />
    </div>
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
  .main {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .main .header {
    flex: 0 0 auto;
    background-color: #3c5e8d;
    min-height: 3rem;
    text-align: center;
    color: white;
  }

  .main .content {
    flex: 1 1 auto;
    overflow-y: auto;
  }
</style>
