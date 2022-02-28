try{
    require('dotenv').config()
}catch(e){}
module.exports = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    OPENSEA_APIKEY: process.env.OPENSEA_APIKEY,
}
