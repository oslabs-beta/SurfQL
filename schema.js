const { gql } = require("apollo-server");
// // typeDefs is a required argument and should be a GraphQL schema language string or array of GraphQL schema language strings or a function that takes no arguments and returns an array of GraphQL schema language strings. The order of the strings in the array is not important, but it must include a schema definition.
const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    username: String!
    age: Int!
    nationality: String!
    friends: [User]
    favoriteMovies: [Movie]
  }
  type Movie {
    id: ID!
    name: String!
    year: Int!
    isInTheaters: Boolean!
  }
  # equivalent to a GET request
  type Query {
    users: [User!]!
    user(id: ID!): User!
    movies: [Movie!]!
    movie(name: String!): Movie!
  }
  # Input types are special object types that allow you to provide hierarchical data as arguments to fields
  input CreateUserInput {
    name: String!
    username: String!
    age: Int!
    nationality: String!
  }
  input UpdateUsernameInput {
    id: ID!
    newUsername: String!
  }
  # equivalent to a POST, PUT, DELETE request
  type Mutation {
    createUser(input: CreateUserInput!): User
    updateUsername(input: UpdateUsernameInput!): User
    deleteUser(id: ID!): User
  }
  # enum Nationality {
  #   CANADA
  #   BRAZIL
  #   INDIA
  #   GERMANY
  #   CHILE
  # }
`;
module.exports = { typeDefs };
