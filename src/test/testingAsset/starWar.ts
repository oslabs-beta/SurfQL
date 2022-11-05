const { gql } = require("apollo-server");

// // typeDefs is a required argument and should be a GraphQL schema language string or array of GraphQL schema language strings or a function that takes no arguments and returns an array of GraphQL schema language strings. The order of the strings in the array is not important, but it must include a schema definition.

const typeDefs = gql`
  type Query {
    heros: [Character]!
    hero(id: ID): Character!
    planets(id: ID): Planet
    starships: [Starship!]!
    human: [Human!]!
    droid: [Droid!]!
  }

  type Character {
    id: Int!
    name: String!
    birthYear: String!
    eyeColor: String
    films: [Film]!
    gender: String
    hairColor: String!
    height: Int
    homeworld: Planet
    skinColor: String
    species: Specie
    starships: [Starship]!
    vehicles: [Vehicle]!
  }

  union Transportationtool = Starship | Vehicle

  type Film {
    id: Int!
    releaseDate: Date!
    esipodeId
    title: String!
    characters: [Character!]!
    director: String!
    planets: [Planet!]!
    producer: String
    species: [Specie]!
    starships: [Starship]!
    vehicles: [Vehicle]!
  }

  type Planet {
    id: Int!
    name: String!
    climate: [Climate]
    diameter(unit: LengthUnit = KILOMETER): Int!
    films: [Film]!
    gravity: String
    population: Int!
    residents: [Character!]!
    rotationPeriod: Int!
    species: [Specie!]!
    surfaceWater: Int
    terrain: [Terrain]
  }

  enum Terrain {
    grasslands
    mountains
    gas giant
    rocky island
    oceans
    fields
    rainforests
    plains
    forests
    rock arches
    verdant
    jungles
    deserts
    hills
    urban
    cityscape
    swamp
    savannas
  }

  type Specie {
    id: Int!
    name: String
    averageHeight: Int
    averageLifespan: Int
    classification: String
    designation: String
    language: String
    people: [Character!]!
    skinColor: []
  }

  scalar Date

  enum Color {
    yellow
    hazel
    blue
    green
    orange
    brown
    grey
    amber
    red
    white
    brown
    black
    magenta
    peach
    tan
    pink
  }

  enum Climate {
    temperate
    moist
    murky
    polluted
    hot
    humid
    arid
    frozen
    tropical
    windy
  }

  type Vehicle {
    id: Int!
    name: String!
    model: String
    films: [Film!]!
    pilots: [Character]!
  }

  type Starship {
    id: Int!
    name: String!
    model: String
    films: [Film!]!
    pilots: [Character]!
    length(unit: LengthUnit = METER): Int!
  }

  enum LengthUnit {
    METER
    KILOMETER
  }

  input CharacterInput {
    id: Int!
    name: String!
    birthYear: String!
    eyeColor: String
    films: [Film]!
    gender: String
    hairColor: String!
    height: Int
    homeworld: Planet
    mass: Int
    skinColor: String
    species: Specie
    starships: Starship
    vehicles: Vehicle
  }

  type Human implements Character {
    id: Int!
    name: String!
    birthYear: String!
    eyeColor: String
    appearsIn: [Film]!
    gender: String
    hairColor: String!
    height: Int
    homeworld: Planet
    skinColor: String
    species: Specie
    starships: [Starship]!
    vehicles: [Vehicle]!
    totalCredits: Int
    transportation: [Transportationtool!]!
  }
  
  type Droid implements Character {
    id: Int!
    name: String!
    birthYear: String!
    eyeColor: String
    appearsIn: [Film]!
    gender: String
    hairColor: String!
    height: Int
    homeworld: Planet
    skinColor: String
    species: Specie
    starships: [Starship]!
    vehicles: [Vehicle]!
    primaryFunction: String
    transportation: [Transportationtool!]!
  }
  

  type Mutation {
    addCharacter(input: CharacterInput): Character!
    addStarship(name: String, model: String): Starship
  }
`;

module.exports = { typeDefs };
