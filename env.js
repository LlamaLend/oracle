try{
    require('dotenv').config()
}catch(e){}
module.exports = {
    OPENSEA_APIKEY: process.env.OPENSEA_APIKEY,
}
