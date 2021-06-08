const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, saveContractProxies, getSavedContractProxies} = require('./utils')
let c = require('../deployments/deploymentConfig.json');

const newOwner = "0xb0b599daE2afF825543cfeb061eb206365dA921f";

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];
    let admin = await upgrades.admin.getInstance();
    await admin.transferOwnership(newOwner);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
