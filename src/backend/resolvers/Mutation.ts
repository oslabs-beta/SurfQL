import { buyers } from "@prisma/client"
import { Context } from "../index"

interface BuyerCreateArgs {
  buyer_email: string
  password: string
  buyer_nickname: string
}

interface BuyerPayloadType {
  buyerErrors: {
    message: string
  }[],
  buyer: buyers | null
}

export const Mutation = {
  createBuyer: async (
    _: any,
    { buyer_email, password, buyer_nickname }: BuyerCreateArgs,
    { prisma }: Context
  ): Promise<BuyerPayloadType> => {

    console.log(buyer_email, password, buyer_nickname)
    //validation step
    if (!buyer_email || !password || !buyer_nickname) {
      return {
        buyerErrors: [{
          message: "You must provide a buyer email and password and buyer nickname "
        }],
        buyer: null
      }
    }
    const buyer = await prisma.buyers.create({
      data: {
        buyer_email,
        password,
        buyer_nickname,
      }
    })

    return {
      buyerErrors: [],
      buyer: buyer
    }
  },
}