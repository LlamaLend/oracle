import {ethers} from "ethers"
import {SecretsManager} from "aws-sdk"
import ddb from './utils/dynamodb'
import { getCurrentAndHistoricalFloor, ReturnableError } from "./utils/listingFloors";

async function getSecret():Promise<string>{
  const client = new SecretsManager({});
  const data = await client.getSecretValue({SecretId: "oracle-privkey"}).promise()
  return JSON.parse(data.SecretString!).oraclePrivateKey;
}

const privkey = getSecret()

async function sign(price:ethers.BigNumber, deadline:number, nftContract:string, chainId:number){
  const signer = new ethers.Wallet(await privkey)
  const message = ethers.utils.arrayify("0x"+new ethers.utils.AbiCoder().encode([ "uint216", "uint", "uint"], [ price, deadline, chainId ]).substr(10+2)+nftContract.substr(2));
  const signature = ethers.utils.splitSignature(await signer.signMessage(message))
  return signature
}


const handler = async (
  event: AWSLambda.APIGatewayEvent
): Promise<any> => {
  const { nftContract, chainId } = event.pathParameters!;
  const normalizedNftContract = nftContract!.toLowerCase()
  if(chainId !== "1"){
    return {
      statusCode: 400,
      body: "Only mainnet supported"
    }
  }

  const now = Math.round(Date.now()/1e3)
  const hoursInWeek = 24*7;
  const weekAgo = now - hoursInWeek*3600;

  try{
    const floorPK = `floor#${chainId}#${normalizedNftContract}`
    const weeklyFloors = (await ddb.query({
      ExpressionAttributeValues: {
          ":pk": floorPK,
          ":start": weekAgo*1000, // ms
      },
      KeyConditionExpression: `PK = :pk AND SK >= :start`,
    }))
    if(weeklyFloors.LastEvaluatedKey !== undefined || weeklyFloors.Items === undefined){
      // Can't read all items! Someone could be attacking us so error out
      return {
        statusCode: 502,
        body: "Too many items stored"
      }
    }

    const currentFloorData = await getCurrentAndHistoricalFloor(normalizedNftContract, process.env.RESERVOIR_API_KEY!)

    const lastFloorPoint = weeklyFloors.Items[weeklyFloors.Items.length-1];
    if (lastFloorPoint === undefined) {
      await ddb.put({
        PK: floorPK,
        SK: Date.now(),
        floor: currentFloorData.currentFloor,
      })
    } else {
      const diffTime = Date.now() - lastFloorPoint.SK;
      if (
        (diffTime > 20 * 60e3) || // 20 mins
        (diffTime > 5 * 60e3 && currentFloorData.currentFloor < lastFloorPoint.floor) || // 5 mins && lower floor
        (currentFloorData.currentFloor <= (lastFloorPoint.floor * 0.8)) // floor is 20% lower or more
      ) {
        await ddb.put({
          PK: floorPK,
          SK: Date.now(),
          floor: currentFloorData.currentFloor,
        })
      }
    }

    const minWeeklyPrice = Math.min(...weeklyFloors.Items.map(w=>w.floor), currentFloorData.weeklyMinimum)

    const ethPrice = ethers.utils.parseEther((minWeeklyPrice).toString())

    const deadline = now + 10*60; // +10 mins
    const signature = await sign(ethPrice, deadline, normalizedNftContract, Number(chainId))

    const body = {
      price: ethPrice.toString(),
      deadline,
      normalizedNftContract,
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
  } catch(e){
    console.log("Error with collection", normalizedNftContract, e)
    if(e instanceof ReturnableError){
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: e.message
        }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
          "Cache-Control": `max-age=${5*60}`, // 5 mins
        },
      };
    }
    throw e;
  }
};

export default handler
