const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress, getSavedContractBytecodes, saveContractBytecode } = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];

    // Load all deployed addresses
    const addresses = getSavedContractAddresses()[hre.network.name];

    const MaintainersRegistry = await ethers.getContractFactory('MaintainersRegistry')
    const maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [addresses["ChainportCongress"], [config.maintainers]]);
    await maintainersRegistry.deployed()
    console.log('MaintainersRegistry deployed to:', maintainersRegistry.address);
    saveContractAddress(hre.network.name, 'MaintainersRegistry', maintainersRegistry.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
