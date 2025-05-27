<!-- src/views/Home.vue -->
<template>
  <div class="home-view">
    <!-- This is shown when no specific route is matched in the main content area -->
    <!-- The actual content is handled by App.vue's welcome message -->
  </div>
</template>

<script setup>
// This component is mostly empty because the main content is handled
// by the router-view in App.vue with named routes
</script>

<style scoped>
.home-view {
  /* This component doesn't need much styling since content is in App.vue */
}
</style>