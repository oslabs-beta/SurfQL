export const indentation = '  '; // TODO: Update based off the config (spacing/tab amount)
export const primatives = [
  'String',
  'Int',
  'ID'
];

export const supportedSchemaParserFileTypes = ["graphql", "graphqls", "ts", "js"];

//! When adding new language support:
// - Add a new comment pattern for the respective language ids in `./lib/suggestions` -> `findBackTick()`
export const supportedSuggestionFileTypeIds = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];

/* 🌊 Terms 🧠 */
// Query Operations - "query" or "mutation" keywords at the start of a query.
// Query Field - The term for the property/key on the query. Ex: "name" or "id"
// Query Scalar - The leaf (or end node) of a query. This is also a field.
