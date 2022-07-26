import {ethers} from "ethers"
import {SecretsManager} from "aws-sdk"

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


const handler = async (
  _event: AWSLambda.APIGatewayEvent
): Promise<any> => {
  const nftContract = "0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b"
  const now = Math.round(Date.now()/1e3)
  const deadline = now + 5*60; // +5 mins
  const price = 0.1
  const ethPrice = ethers.utils.parseEther(price.toString())
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
      "Cache-Control": `max-age=${2*60}`, // 2 mins
    },
  };
};

export default handler
