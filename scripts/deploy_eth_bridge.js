const hre = require("hardhat")
const { saveContractAddress, getSavedContractAddresses } = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');

    const config = c[hre.network.name];


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
