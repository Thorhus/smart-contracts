const hre = require("hardhat");
const assert = require('assert');
const { getSavedContractAddresses, getSavedContractProxies, getSavedContractProxyAbis } = require('../scripts/utils')

async function main() {

    await hre.run('compile')

    const contracts = getSavedContractAddresses()[hre.network.name]
    const proxies = getSavedContractProxies()[hre.network.name]
    const abi = getSavedContractProxyAbis()["ProxyAdmin"]
    const admin = await hre.ethers.getContractAt(abi, proxies["ProxyAdmin"])
    const standard = 42

    console.log("-".repeat(46*4));
    console.log(
        "|Proxy Name:"," ".repeat(standard - "Proxy Name:".length),"|",
        "Local Address:"," ".repeat(standard - "Local Address:".length),"|",
        "Proxy Address:"," ".repeat(standard - "Proxy Address:".length),"|",
        "Is Synced"," ".repeat(standard - "Is Synced".length),"|"
    )
    console.log("-".repeat(46*4));

    for(var proxy in proxies){
        if(proxy !== "ProxyAdmin"){
            let localImplementation = contracts[proxy];
            let proxyImplementation = await admin.getProxyImplementation(proxies[proxy]);
            let isSynced = false
            if(localImplementation === proxyImplementation) isSynced = true
            console.log(
                "|"+proxy," ".repeat(standard - proxy.length),"|",
                localImplementation," ".repeat(standard - localImplementation.length),"|",
                proxyImplementation," ".repeat(standard - proxyImplementation.length),"|",
                isSynced," ".repeat(standard - isSynced.toString().length),"|"
            );
        }
    }

    console.log("-".repeat(46*4));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1);
    });
