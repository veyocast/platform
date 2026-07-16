import "../src/styles.css";

import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    a11y: {
      test: "todo"
    },
    controls: {
      expanded: true
    }
  }
};

export default preview;
