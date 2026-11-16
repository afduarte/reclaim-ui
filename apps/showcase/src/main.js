import { createApp } from "vue";
import App from "./App.vue";

// curated "ship" fonts (self-hosted). Registry only ever bundles these.
import "@fontsource-variable/fraunces/index.css";
import "@fontsource-variable/public-sans/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "@fontsource-variable/archivo/index.css";
import "@fontsource-variable/figtree/index.css";

import "@reclaim/ui/styles/tailwind.css";
import { installThemeStyles } from "./themes.js";
import { applyThemeAttrs } from "./themes.js";

installThemeStyles();
applyThemeAttrs();

createApp(App).mount("#app");
