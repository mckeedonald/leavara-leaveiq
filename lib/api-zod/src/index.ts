export * from "./generated/api";
export * from "./generated/types";
// Both modules surface `SendNoticesResponse` (zod schema in ./generated/api,
// duplicate interface in ./generated/types). Re-export the api version explicitly
// to resolve the `export *` ambiguity (TS2308).
export { SendNoticesResponse } from "./generated/api";
