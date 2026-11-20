<script setup>
import { ToastProvider, ToastViewport } from "reka-ui";
import Toast from "./Toast.vue";
import { toasts } from "../toast.js";
</script>

<template>
  <ToastProvider>
    <ToastViewport class="rc-toast-viewport">
      <Toast v-for="t in toasts" :key="t.id" v-bind="t" />
    </ToastViewport>
  </ToastProvider>
</template>
