<script setup>
// Thin wrapper: consumers write plain thead/tbody markup; the shape language
// (uppercase micro-headers, hairline rows, hover tint) lives in one CSS place.
</script>

<template>
  <div>
    <table class="rc-table">
      <slot />
    </table>
  </div>
</template>
