import { ethers } from "ethers"
import { fetchIpfsUrl } from "./utils";

const tubbyNftContract = "0xCa7cA7BcC765F77339bE2d648BA53ce9c8a262bD".toLowerCase()
const tubbyLoanAddress = "0x608e61Ea277bCfD2f19dc8F6586a5f89Fbb5B4A4"
const provider = new ethers.providers.CloudflareProvider()

const handler = async (
    event: AWSLambda.APIGatewayEvent
): Promise<any> => {
    let { nftContract, nftId } = event.pathParameters!;
    nftContract = tubbyNftContract; // overwrite
    const tubbyLoan = new ethers.Contract(
        tubbyLoanAddress,
        //function loans(uint256 id) public view returns (nft uint256, startTime uint256, startInterestSum uint256, borrowed uint256)
        [{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"loans","outputs":[{"internalType":"uint256","name":"nft","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"startInterestSum","type":"uint256"},{"internalType":"uint256","name":"borrowed","type":"uint256"}],"stateMutability":"view","type":"function"}],
        provider
    )
    const nftUsed = await tubbyLoan.loans(nftId)
    const nft = new ethers.Contract(
        nftContract,
        ['function tokenURI(uint256 id) public view returns (string memory)'],
        provider
    )
    const nftUrl = await nft.tokenURI(nftUsed.nft)
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