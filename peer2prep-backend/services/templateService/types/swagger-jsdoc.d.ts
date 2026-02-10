declare module "swagger-jsdoc" {
  import { OpenAPIV3 } from "openapi-types";

  interface Options {
    definition: OpenAPIV3.Document;
    apis: string[];
  }

  function swaggerJsdoc(options: Options): OpenAPIV3.Document;

  export default swaggerJsdoc;
}