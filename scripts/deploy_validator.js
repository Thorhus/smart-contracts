const hre = require("hardhat");
const { saveContractAddress} = require('./utils')

async function main() {

    await hre.run('compile');

    const Validator = await hre.ethers.getContractFactory('Validator');
    const validator = await Validator.deploy();
    await validator.deployed();
    console.log('New Validator implementation: ', validator.address);
    saveContractAddress(hre.network.name, 'Validator', validator.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
