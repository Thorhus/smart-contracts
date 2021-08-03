const hre = require('hardhat')
const Web3 = require('web3');
const fs = require('fs')
const path = require('path')
const standard = 65

function getRpcUrls() {
    let json
    try {
        json = fs.readFileSync(path.join(__dirname, `./rpcs.json`))
    } catch (err) {
        json = '{}'
    }
    return JSON.parse(json)
}

async function main() {
    const network = getRpcUrls()[hre.network.name];
    console.log("RPC URL:"," ".repeat(standard - "RPC URL:".length),"Block Number:")
    for(const url in network){
        if(network.hasOwnProperty(url)){
            const web3 = new Web3(new Web3.providers.HttpProvider(network[url].toString()));
            const currentBlock = await web3.eth.getBlock("latest");
            console.log(network[url].toString()," ".repeat(standard-network[url].toString().length), currentBlock.number);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1);
    });
