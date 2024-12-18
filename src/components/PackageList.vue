<template>
  <div class="packages" v-if="packagesRef" :class="{'has-advisories': totalVulnerablePackages > 0}">
    <h4 class="title"><label for="package-search">Search</label></h4>
    <div class="search" :class="{'filtering-advisories': filtersRef.hasAdvisories}">
      <input name="package-search" v-model="filtersRef.search" />
      <button type="button" v-if="totalVulnerablePackages" :title="totalVulnerablePackages + ' packages with vulnerabilities'" @click="filtersRef.hasAdvisories = filtersRef.hasAdvisories ? null : true">
        <Octicon name="alert" :size="24" />
        <sup>{{totalVulnerablePackages}}</sup>
      </button>
    </div>
    <h4 class="title">Packages</h4>
    <div class="package" v-for="pkg in filteredPackages" :class="{'project': pkg.isProjectDependency, 'transitive': !pkg.isProjectDependency, 'advisory': pkg.advisories.length > 0 }">
      <div class="banner"></div>
      <span class="package-name anchor" @click="onPackageSelected(pkg)" :title="pkg.name">{{ pkg.name }}</span>
      <div class="attributes">
        <span class="attribute version" :title="(pkg.isProjectDependency ? 'Project' : 'Transitive') + ' dependency'"><Octicon :size="16" :name="pkg.advisories.length ? 'alert-fill' : 'check-circle-fill'" /> {{ pkg.version }}</span>
        <span class="attribute" title="Package dependencies"><Octicon name="package-dependencies" :size="16" /> {{ pkg.dependencies.length }}</span>
        <span class="attribute" title="Package references"><Octicon name="package-dependents" :size="16" /> {{ pkg.totalReferences }}</span>
      </div>
      <div class="advisories" v-if="pkg.advisories.length > 0">
        <a v-for="advisory in pkg.advisories" 
          :href="'https://github.com/advisories/' + advisory.id"
          target="_blank"
          :title="advisory.score">{{ advisory.id }} ({{ advisory.severity }})</a>
      </div>
    </div>
    <div v-if="!filteredPackages || filteredPackages.length === 0">
      <p>No packages found</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .packages {
    min-height: 100%;
    box-sizing: border-box;
    resize: horizontal;
    width: 400px;
    background-color: #efefef;

    .title {
      margin: 0.375rem 0;
      font-weight: 500;

      &:first-child {
        margin-top: 0;
      }
    }

    .search {
      display: block;
      position: relative;

      input {
        padding: 0.75rem;
        display: block;
        width: 100%;
        border-radius: 6px;
      }

      button {
        position: absolute;
        right: 0.5rem;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: 1px solid transparent;
        border-radius: 6px;
      }

      button:hover {
        background: #eee;
        border: 1px solid #666;
      }

      &.filtering-advisories {
        button {
          background: #eee;
          border: 1px solid #666;
        }
      }
    }

    &.has-advisories {
      .search input {
        padding-right: 80px;
      }
    }

    .package {
      padding: 0.375rem;
      padding-left: 0.8750rem;
      color: rgb(101, 109, 118);
      background-color: white;
      margin: 0.375rem 0;
      position: relative;
      border: 1px solid rgb(208, 215, 222);
      border-radius: 5px;
    }

    .package-name {
      display: block;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }

    .banner {
      position: absolute;
      top: -1px; left: 0; bottom: -1px;
      width: 0.5rem;
      margin: 0;
      padding: 0;
      border-radius: 6px;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }

    .package.project {
      .banner { background-color: rgb(4, 98, 152); }
      .version {  color: rgb(4, 98, 152); }
    }

    .package.transitive {
      .banner { background-color: rgb(87, 87, 87); }
      .version { color: rgb(87, 87, 87); }
    }

    .package.advisory {
      .banner { background-color: red !important; }
      .version { color: red; }
    }

    .attributes {
      display: flex;
      flex-direction: row;
      margin: 0.375rem 0;
    }

    .attribute {
      margin-right: 0.875rem;
      font-size: 0.875rem;        
      height: 16px;
    }

    .attribute.advisory {
      color: red;
    }

    .advisories a {
      margin-right: 0.375rem;
      color: red;
      text-decoration: none;
    }
  }
</style>

<script setup lang="ts">
  import type { PackageAdvisory } from '@/lib/advisories';
  import type { PackageGraph } from '@/lib/packages';

  import { withDefaults, computed, ref } from 'vue';
  import { compare as compareSemver } from '@/lib/semver';

  import Octicon from './Octicon.vue';

  export interface Props {
    projectId: string | null;
    graph: PackageGraph | null;
    advisories: PackageAdvisory[] | null;
  };

  interface PackageSummary {
    id: string;
    name: string;
    isProjectDependency: boolean;
    totalReferences: number;
    version: string;
    advisories: PackageAdvisory[];
    dependencies: [];
  };

  interface Dependency {
    id: string;
    name: string;
    versionRange: string;
  };

  interface PackageFilters {
    search: string | null;
    isProjectDependency: boolean | null;
    hasAdvisories: boolean | null;
  };

  const props = withDefaults(defineProps<Props>(), {
    projectId: null,
    graph: null,
    advisories: null
  });

  const filtersRef = ref<PackageFilters>({ search: null, isProjectDependency: null, hasAdvisories: null });
  const packagesRef = computed(computePackages);
  const filteredPackages = computed(filterPackages,);
  const totalVulnerablePackages = computed(countVulnerablePackages);
  
  const emit = defineEmits(['packageSelected']);

  function onPackageSelected(pkg: PackageSummary) {
    emit('packageSelected', { id: pkg.id });
  }

  function filterPackages(): PackageSummary[] | null {
    const packages = packagesRef.value;
    const filters = filtersRef.value;

    if (packages == null)
      return null;

    return packages.filter(p => (filters.search == null || p.id.indexOf(filters.search.toLowerCase()) >= 0)
      && (filters.hasAdvisories == null || (filters.hasAdvisories ? p.advisories.length > 0 : p.advisories.length === 0))
      && (filters.isProjectDependency == null || (p.isProjectDependency == filters.isProjectDependency)));
  }

  function countVulnerablePackages(): number {
    return filteredPackages.value != null
      ? filteredPackages.value.reduce((total, pkg) => total + (pkg.advisories.length > 0 ? 1 : 0), 0)
      : 0;
  }

  function computePackages(): PackageSummary[] | null {
    const graph = props.graph;
    const rootId = props.projectId;

    if (graph == null || rootId == null)
      return null;

    const packages = Object.keys(graph)
      .filter(pid => pid !== rootId) // filter out the root package from the list
      .map(pid => {
        const node = graph[pid];

        return <PackageSummary>({
          id: pid,
          name: node.name,
          isProjectDependency: node.references.some(r => r.id === rootId),
          version: node.version,
          totalReferences: node.references.length,
          advisories: computePackageAdvisories(pid, node.version),
          dependencies: node.dependencies.map(dep => {
            const depNode = graph[dep.id];
            return <Dependency>({ id: dep.id, name: depNode.name, versionRange: dep.versionRange });
          })
        });
      });

    return packages.sort((a, b) => (a.isProjectDependency === b.isProjectDependency)
        ? (a.name.localeCompare(b.name))
        : (a.isProjectDependency ? -1 : 1));
  }

  function computePackageAdvisories(packageId: string, resolvedVersion: string): PackageAdvisory[] {
    if (props.advisories == null)
      return [];

    return props.advisories.filter(advisory => advisory.package.toLowerCase() == packageId
        && (advisory.introduced == '0' || compareSemver(advisory.introduced, resolvedVersion) <= 0)
        && (advisory.fixed == null || compareSemver(advisory.fixed, resolvedVersion) > 0)
    );
  }
</script>