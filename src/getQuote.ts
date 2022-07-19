import {ethers} from "ethers"
import {SecretsManager} from "aws-sdk"

async function getSecret():Promise<string>{
  const client = new SecretsManager({});
  const data = await client.getSecretValue({SecretId: "oracle-privkey"}).promise()
  console.log(data)
  return data.SecretString!;
}

const privkey = getSecret()

async function sign(price:number, deadline:number, nftContract:string){
  const signer = new ethers.Wallet(await privkey)
  const message = ethers.utils.arrayify(new ethers.utils.AbiCoder().encode([ "uint", "uint"], [ price, deadline ])+nftContract.substr(2));
  const signature = ethers.utils.splitSignature(await signer.signMessage(message))
  return signature
}


const handler = async (
  _event: AWSLambda.APIGatewayEvent
): Promise<any> => {
  const body = {}

  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  };
};

export default handler
