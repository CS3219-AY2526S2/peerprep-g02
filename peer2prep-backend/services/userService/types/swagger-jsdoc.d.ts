declare module "swagger-jsdoc" {
    interface Options {
        definition: Record<string, unknown>;
        apis: string[];
    }

    function swaggerJsdoc(options: Options): Record<string, unknown>;

    export default swaggerJsdoc;
}
