const { compileFromFile } = require("json-schema-to-typescript");
const { writeFileSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");

async function generate() {
  const schema = resolve(__dirname, "../../packages/shared/schemas/case.v1.schema.json");
  const source = await compileFromFile(schema, {
    bannerComment: "/* Generated from the master case schema. Run npm run generate:case --workspace server. */",
  });
  const folder = resolve(__dirname, "../src/generated");
  mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, "case.ts"), source);
}
generate().catch((error) => { console.error(error); process.exitCode = 1; });
