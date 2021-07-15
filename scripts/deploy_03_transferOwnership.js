const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, saveContractProxies, getSavedContractProxies, getSavedContractProxyAbis} = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];
    const proxies = getSavedContractProxies()[hre.network.name];
    const abi = getSavedContractProxyAbis()["ProxyAdmin"];
    const admin = await hre.ethers.getContractAt(abi, proxies["ProxyAdmin"]);
    await admin.transferOwnership(contracts["ChainportCongress"]);
    console.log("Ownership successfully transfered to ChainportCongress");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
