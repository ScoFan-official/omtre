import DefaultTheme from "vitepress/theme";
import MaturityBadge from "./components/MaturityBadge.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("MaturityBadge", MaturityBadge);
  },
};
