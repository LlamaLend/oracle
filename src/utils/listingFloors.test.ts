import { getCurrentAndHistoricalFloor } from "./listingFloors"

require("dotenv").config()
getCurrentAndHistoricalFloor("0xF17Bb82b6e9cC0075ae308e406e5198BA7320545", process.env.RESERVOIR_API_KEY!).then(console.log)

