const hre = require("hardhat");
const { getSavedContractABI, saveContractAbi } = require('./utils');
let c = require('../deployments/deploymentConfig.json');


async function main() {
    await hre.run('compile');

    saveContractAbi(hre.network.name, 'ChainportMainBridge', (await hre.artifacts.readArtifact("ChainportMainBridge")).abi)
    saveContractAbi(hre.network.name, 'Validator', (await hre.artifacts.readArtifact("Validator")).abi)
    saveContractAbi(hre.network.name, 'MaintainersRegistry', (await hre.artifacts.readArtifact("MaintainersRegistry")).abi)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
