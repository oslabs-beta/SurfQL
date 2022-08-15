import { gql } from "apollo-server";
export const typeDefs = gql`
  type Query {
    hello: String!
  }

  type Mutation {
    createBuyer(buyer_email: String!, password:String!, buyer_nickname: String!): BuyerPayload!
    updateBuyer(pk_buyer_id:Int!,buyer_email: String!,password: String!,buyer_nickname: String!) : String!
  }
  type Buyer {
    pk_buyer_id : Int!
    buyer_email: String!
    password: String!
    buyer_nickname: String!
    Orders : [Order!]!
  }
  type BuyerError {
    message: String!
  }

  type BuyerPayload {
    buyerErrors: [BuyerError!]!
    buyer: Buyer
  }

  type Dish {
    pk_dish_id: Int!
    dish_name : String!
    description: String!
  }

  type Order_Dish {
    pk_od_id: Int!
    fk_od_id: Int!
    fk_dish_id: Int!
    dishes: [Dish!]!
    fulfilled : Boolean!
  }

  type Order {
    pk_order_id: Int!
    fulfilled : Boolean!

  }

`
