import { createApp } from "vue";
import App from "./App.vue";

// fonts are lazy-loaded per theme by the store (see FONT_LOADERS in themes.js)
import "@reclaim/ui/styles/tailwind.css";
import { bootstrap } from "./themes.js";

await bootstrap();
createApp(App).mount("#app");
