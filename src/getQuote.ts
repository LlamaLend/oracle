import {ethers} from "ethers"
import {SecretsManager} from "aws-sdk"
import { getFloorNow } from "./utils";
import ddb from './dynamodb'

async function getSecret():Promise<string>{
  const client = new SecretsManager({});
  const data = await client.getSecretValue({SecretId: "oracle-privkey"}).promise()
  return JSON.parse(data.SecretString!).oraclePrivateKey;
}

const privkey = getSecret()

async function sign(price:ethers.BigNumber, deadline:number, nftContract:string){
  const signer = new ethers.Wallet(await privkey)
  const message = ethers.utils.arrayify(new ethers.utils.AbiCoder().encode([ "uint", "uint"], [ price, deadline ])+nftContract.substr(2));
  const signature = ethers.utils.splitSignature(await signer.signMessage(message))
  return signature
}

const nftContract = "0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b"

const handler = async (
  _event: AWSLambda.APIGatewayEvent
): Promise<any> => {
  const now = Math.round(Date.now()/1e3)
  const hoursInWeek = 24*7;
  const weekAgo = now - hoursInWeek*3600;

  const currentFloor = await getFloorNow()
  const weeklyFloors = (await ddb.query({
    ExpressionAttributeValues: {
        ":pk": `floor#${nftContract}`,
        ":start": weekAgo,
    },
    KeyConditionExpression: `PK = :pk AND SK >= :start`,
  })).Items ?? []

  console.log("items", weeklyFloors.length)
  if(weeklyFloors.length <= (hoursInWeek - 1)){
    return {
      statusCode: 501,
      body: "Not enough historical data",
    }
  }

  const minWeeklyPrice = Math.min(...weeklyFloors.map(w=>w.floor), currentFloor)

  const ethPrice = ethers.utils.parseEther((minWeeklyPrice/3).toString())

  const deadline = now + 20*60; // +20 mins
  const signature = await sign(ethPrice, deadline, nftContract)

  const body = {
    price: ethPrice.toString(),
    deadline,
    nftContract,
    signature:{
      v: signature.v,
      r: signature.r,
      s: signature.s
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Cache-Control": `max-age=${5*60}`, // 5 mins
    },
  };
};

export default handler
