import { createApp } from "vue";
import App from "./App.vue";

// fonts are lazy-loaded per theme by the store (see FONT_LOADERS in themes.js)
import "@reclaim/ui/styles/tailwind.css";
import { installThemeStyles } from "./themes.js";
import { applyThemeAttrs } from "./themes.js";

installThemeStyles();
applyThemeAttrs();

createApp(App).mount("#app");
