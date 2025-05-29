module.exports = {
  api: {
    output: {
      mode: "tags",
      target: "src/lib/api",
      schemas: "src/lib/models",
      client: "react-query",
      mock: true,
      baseUrl: "http://localhost:3000",
    },
    input: {
      target: "./openapi.json",
    },
  },
};
