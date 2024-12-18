<template>
  <div class="main">
    <nav class="header">
      <h3 v-if="!projectAssetsRef">.NET Dependency Visualiser</h3>
      <h3 v-else>Dependencies for {{ projectAssetsRef.project.restore.projectName }}</h3>
    </nav>
    <div class="content" @dragover.prevent @drop="onDrop">
      <p v-if="!graphRef" class="help">Please drag and drop a <pre>project.assets.json</pre> file into the window to begin.</p>
      <div v-else class="visualiser">
        <PackageList :project-id="projectIdRef" :graph="graphRef" :advisories="advisoriesRef" @package-selected="onPackageSelected" class="package-list" />
        <Visualiser :project-id="projectIdRef" :graph="graphRef" :package-id="selectedPackageRef?.id" class="graph" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { PackageGraph, ProjectAssets } from './lib/packages';
  import type { PackageAdvisory } from './lib/advisories';

  import { ref } from 'vue';
  import { createPackageGraph, getPackageId } from './lib/packages';
  
  import Visualiser from './components/Visualiser.vue';
  import PackageList from './components/PackageList.vue';

  const graphRef = ref<PackageGraph | null>(null);
  const projectAssetsRef = ref<ProjectAssets | null>(null);
  const projectIdRef = ref<string | null>(null);
  const advisoriesRef = ref<PackageAdvisory[] | null>(null);
  const selectedPackageRef = ref<{ id: string } | null>(null);

  loadAdvisoriesAsync();

  async function loadAdvisoriesAsync() {
    const res = await fetch('./advisories/nuget-advisories.json');
    const advisories = await res.json();

    advisoriesRef.value = advisories as PackageAdvisory[];
  }

  function onPackageSelected(pkg: { id: string }) {
    selectedPackageRef.value = pkg;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();

    if (e.dataTransfer?.items != null) {
      Array.prototype.forEach.call(e.dataTransfer.items, async (item: DataTransferItem) => {
        if (item.kind === 'file') {
          const file = item.getAsFile()!;
          const json = await file.text();

          const assets = JSON.parse(json) as ProjectAssets;
          projectAssetsRef.value = assets;

          const projectName = assets.project.restore.projectName;
          const projectId = getPackageId(projectName);

          projectIdRef.value = projectId;
          graphRef.value = createPackageGraph(projectId, projectName, assets, null!);
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
    background-color: rgb(4, 98, 152);

    h3 {
      text-align: center;
      margin: 0.5rem;
      color: white;
      font-weight: 500;
    }
  }

  .main .content {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .help {
    text-align: center;
    width: 100%;
    margin-top: 5rem;
  }

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

  .package-list {
    flex: 0 0 auto;
    max-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    text-overflow: ellipsis;
    padding: 1rem;
    margin: 0;
  }
</style>
