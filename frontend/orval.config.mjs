import { defineConfig } from "orval";

export default defineConfig({
  api: {
    output: {
      mode: "tags-split",
      target: "src/lib/api",
      schemas: "src/lib/models",
      client: "react-query",
      mock: true,
    },
    input: {
      target: "./openapi.json",
    },
  },
});
