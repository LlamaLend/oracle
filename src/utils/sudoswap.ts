import { gql, request } from "graphql-request"
import {multiCall} from "@defillama/sdk/build/abi"

const collectionsRequest = gql`
query Floor($collection: ID!, $firstItem: ID!){
	collection(id: $collection) {
		pairs(first: 1000, where: {
			numNfts_gt: 0,
			id_gte: $firstItem
		}) {
			id
			type
			bondingCurve
			delta
			fee
			spotPrice
			ethBalance
		}
	}
}
`

// https://sudoswap.xyz/#/browse/pools/0xeF1a89cbfAbE59397FfdA11Fc5DF293E9bC5Db90

export async function getSudoswapFloor(collection: string) {
	let pools = [] as any[]
	let firstItem = ''
	let res;
	do {
		res = (await request('https://api.thegraph.com/subgraphs/name/zeframlou/sudoswap', collectionsRequest, {
			firstItem, 
			collection:collection.toLowerCase()
		}));
		if(res.collection === null || (res.collection.pairs.length === 0 && pools.length === 0)){
			// No pools in sudoswap
			return null
		}
		res = res.collection.pairs
		pools = pools.concat(res);

		firstItem = res[res.length - 1].id
	} while (res.length === 1e3)
	const {output} = await multiCall({
		abi: {"inputs":[{"internalType":"uint128","name":"spotPrice","type":"uint128"},{"internalType":"uint128","name":"delta","type":"uint128"},{"internalType":"uint256","name":"numItems","type":"uint256"},{"internalType":"uint256","name":"feeMultiplier","type":"uint256"},{"internalType":"uint256","name":"protocolFeeMultiplier","type":"uint256"}],"name":"getBuyInfo","outputs":[{"internalType":"enum CurveErrorCodes.Error","name":"error","type":"uint8"},{"internalType":"uint128","name":"newSpotPrice","type":"uint128"},{"internalType":"uint128","name":"newDelta","type":"uint128"},{"internalType":"uint256","name":"inputValue","type":"uint256"},{"internalType":"uint256","name":"protocolFee","type":"uint256"}],"stateMutability":"pure","type":"function"},
		calls: pools.map(pool=>({
			target: pool.bondingCurve,
			params: [
				pool.spotPrice,
				pool.delta,
				1, // numItems
				pool.fee,
				"5000000000000000", // protocolFeeMultiplier
				// to get protocolFeeMultiplier call the method by that name on https://etherscan.io/address/0xb16c1342e617a5b6e4b631eb114483fdb289c0a4#readContract
			],
			chain: "ethereum"
		}))
	})
	const minimum = output.map(p=>p.output.inputValue).reduce((min, pool)=>Math.min(min, pool)) // if an output is null this will crash - good
	return minimum/1e18
}

/* good tests:
  getSudoswapFloor("0x8479277aacff4663aa4241085a7e27934a0b0840").then(console.log) - no pools (roe)
  "0xeF1a89cbfAbE59397FfdA11Fc5DF293E9bC5Db90" - based ghouls
*/