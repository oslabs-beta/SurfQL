export const indentation = '  '; // TODO: Update based off the config (spacing/tab amount)
export const primatives = [
  'String',
  'Int',
  'ID'
];

export const supportedSchemaParserFileTypes = ["graphql", "graphqls", "ts", "js"];

//! When adding new language support:
// - Update `./lib/suggestions` -> `parseDocumentQuery()`
//   to look for the associated language id's multi-line
//   string character(s) and comment characters.
export const supportedSuggestionFileTypeIds = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];

/* 🌊 Terms 🧠 */
// Query Operations - "query" or "mutation" keywords at the start of a query.
// Query Field - The term for the property/key on the query. Ex: "name" or "id"
// Query Scalar - The leaf (or end node) of a query. This is also a field.
