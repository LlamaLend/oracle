# LlamaLend oracle
This oracle is not like most oracles, LlamaLend is unique in that:
- It targets illiquid NFTs whose price is very easy to manipulate
- It doesn't need an oracle that is always available and always has the right price

LlamaLend only uses oracle prices when a new loan is created, everything else doesn't use the oracle, so, if it stops working, users can still repay their loans, LPs can still deposit and withdraw and loans can be liquidated, the only problem is that users wont be able to create new loans.

LlamaLend also doesn't require the exact price of an NFT, instead it operates on the assumption that oracle price must be lower or equal than the real price. If an NFT is priced at 1 ETH and we quote 0.5 eth nothing happens. At most, users won't want to take new loans because loan LTV will be too low, but if we quote 10 ETH instead that enables an arb where a user can:
1. Buy an nft for 1 eth
2. Take a loan, nft is priced at 10eth so we borrow 3.3 eth with 30% LTV
3. Now we have made 2.3 eth, repeat steps 1-2 till we drain the pool

For this reason we must avoid at all costs returning an inflated price. Instead, if something is sketchy it's better to either return a low price or just not return anything. This is fundamentally different from all other oracles, that need to always be available and always have the correct price.

Furthermore, this aims to be an oracle that can serve price data for arbitrary NFTs, which makes it quite hard to build since it means we can't just run cronjobs on the nfts we want to price.

## How to avoid manipulation
Goal is for this to work on any NFT collection, and this includes collections that have value but see very little sales over large periods of time, have no market makers and people rarely check on them.

This means that spot price can't be used, since it's possible that someone could pump the price of one of these collections and none of the other collectors would notice and lower the floor until a day later or more. Remember that, unlike ERC20 coins, for illiquid NFTs when there's price manipulation it's impossible for most people to arbitrage it since most NFTs are traded on a single place, only a few NFTs are listed and only other NFT holders can lower the floor. So, it may take long for other holders to notice and make new listings.

The consequence of this is that oracle price should not be based on a short time period nor it should use most statistical aggregation functions like average, median, TWAP, quartiles... This is because if liquidity is thin and an attacker can clear listings they can set any price, including infinity. And a TWAP of any other prices and infinity is infinity, same for average or median.

For these reasons I believe the best solution is a weekly minimum, since it makes it impossible to alter price of a collection without maintaining it up for a whole week. And if the price of a collection stays at a point for over a week then that's not manipulation, that's it's real price.

But what price data do you use to construct that? Sales data is the easiest to get but using that would be a mistake since with NFTs it's possible to trade out of the central limit. The floor of an NFT can be at 1 ETH but you could trade that NFT for 0.1 or 100 eth, thus it becomes very easy to manipulate prices by washtrading the NFT.

This is specially important because multiple NFT analytics platforms determine floor prices by taking the 20% quartile of on-chain sales, so it's possible to manipulate their floor price by wash-trading above or below floor.

The solution is to use actual floor prices based on listings.

## Data sources
When a new price is requested, the oracle looks at 4 data sources:
- Current floor price on sudoswap
- NFTGo's floor price chart
- Reservoir's floor price changes over the last 7 days
- Own database of past prices

We take all this data and calculate the minimum price among all of them, which makes it so to get an incorrect price all of these sources would need to be manipulated, and as long as a single source is correct we'll be fine.

Our own database acts as an extra backup: every time we fetch prices because of an oracle request, we'll store the current price in our db, and then when we fetch prices for new oracle requests we retrieve the prices stored in the last 7 days and use those in the calculation as well. This acts as a last line of defense, such that if all external sources are manipulated but we've received previous requests to price this collection (common for collections that see usage in llamalend), we can use those previous prices as a backstop.

Many of our sources require iterating over multiple pages, so it's important to make sure that, if for some reason we can't iterate through all of them, we fail the whole query, as otherwise it would be possible to force the oracle to only have partial results (eg: by making lots of queries they could cause an api to rate limit our server, making certain queries fail and forcing us to only have partial data).

Finally, for a few select collections we have a cronjob running hourly and storing new prices into our db for extra security. Again, it's possible to attack this by making lots of queries, getting our server rate-limitted and causing a failure in some queries, thus not storing old prices. We prevent this by storing a price of 0, which effectively disables the oracle for that collection, if 3 different attempts at getting the price fail.

## Staleness
Because of how our oracle works, we provide price signatures that can be submitted during a window of time:
- If that window of time is too small its possible that if a user's tx takes a while to execute it will revert because oracle message expired.
- If that window is too large price data can become stale, which is very significant during quick price drops

Right now oracle expiration deadlines are set to 20 minutes after the message is signed, which I think is a good trade-off.

## Risk
If an NFT collection is not traded in one of the marketplaces tracked by one of our price sources, someone could try to manipulate our data and take advantage of the lack of liquidity there (since we wont have weekly data) to manipulate prices.

Please don't use this oracle for any collection that doesn't meet this criteria.

## Scripts
```
export AWS_REGION='eu-central-1' && export tableName='prod-table' && npx ts-node src/<script>
```