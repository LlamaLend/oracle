import { ethers } from "ethers"
import { fetchIpfsUrl } from "./utils";

const tubbyNftContract = "0xf5de760f2e916647fd766B4AD9E85ff943cE3A2b".toLowerCase()
const provider = new ethers.providers.CloudflareProvider()

const handler = async (
    event: AWSLambda.APIGatewayEvent
): Promise<any> => {
    let { nftContract, nftId } = event.pathParameters!;
    nftContract = tubbyNftContract; // overwrite
    const nft = new ethers.Contract(
        nftContract,
        ['function tokenURI(uint256 id) public view returns (string memory)'],
        provider
    )
    const nftUrl = await nft.tokenURI(nftId)
    const metadata = await fetchIpfsUrl(nftUrl).then(r => r.json())
    return {
        statusCode: 200,
        body: JSON.stringify({
            "name": `Tubby Collateral: ${metadata.name}`,
            "description": "Tubby cat used for collateral. Be careful when buying cause the loan for this NFT might have already expired!",
            "image": `https://api.tubbysea.com/image/${Buffer.from(metadata.image).toString('base64')}`,
            "attributes": metadata.attributes
        }),
        headers: {
            "Content-Type": "application/json",
        }
    }
}

export default handler