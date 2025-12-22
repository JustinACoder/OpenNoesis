module.exports = {
  api: {
    output: {
      mode: "tags",
      target: "src/lib/api",
      schemas: "src/lib/models",
      client: "react-query",
      httpClient: "fetch",
      baseUrl: "http://localhost:8000",
      // override: {
      //   mutator: {
      //     path: "./src/lib/axiosClient.ts",
      //     name: "customInstance",
      //   },
      // },
      override: {
        mutator: {
          path: "./src/lib/fetchClient.ts",
          name: "customFetch",
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
    input: {
      target: "./openapi.json",
    },
  },
};
