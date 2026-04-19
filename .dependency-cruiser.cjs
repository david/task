module.exports = {
  forbidden: [
    {
      name: "no-production-imports-from-tests",
      severity: "error",
      comment: "Production code must not depend on tests.",
      from: { path: "^src/(?!.*\\.test\\.ts$).+\\.ts$" },
      to: { path: "\\.test\\.ts$" },
    },
    {
      name: "core-must-not-depend-on-adapters-or-infrastructure",
      severity: "error",
      comment: "Core/event-model code must stay independent from adapters and filesystem infrastructure.",
      from: { path: "^src/(json-schema\\.ts|tracker/(event-core|event-fold|stores)\\.ts)$" },
      to: {
        path: "^src/(infrastructure/|task\\.ts$|commands(?:-shared|-store|-registry)?\\.ts$|tracker/(root|projections|migrate|settings|issues|issue-create|hierarchy)\\.ts$)",
      },
    },
    {
      name: "no-node-io-outside-adapters-or-infrastructure",
      severity: "error",
      comment: "Direct Node fs/path/os/crypto access is limited to CLI adapters and infrastructure layers.",
      from: {
        path: "^src/(?!task\\.ts$|commands(?:-shared|-store)?\\.ts$|infrastructure/|tracker/).+\\.ts$",
      },
      to: { path: "^node:(fs|path|os|crypto)$" },
    },
    {
      name: "sibling-infrastructure-adapters-should-not-import-each-other",
      severity: "error",
      comment: "Keep infrastructure helpers isolated; share through higher-level modules instead of lateral dependencies.",
      from: { path: "^src/infrastructure/[^/]+\\.ts$" },
      to: {
        path: "^src/infrastructure/[^/]+\\.ts$",
        pathNot: "^src/infrastructure/json\\.ts$",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: "^(node_modules|packages/esther)",
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
