import SwaggerParser from "@apidevtools/swagger-parser";

try {
  const api = await SwaggerParser.validate("openapi.yaml");
  const paths = Object.keys(api.paths ?? {});
  console.log(`OpenAPI válido: ${paths.length} rutas documentadas.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
