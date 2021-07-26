const hre = require("hardhat")
const assert = require('assert');
const { getSavedContractAddresses } = require('../scripts/utils')
let conf = require('../deployments/deploymentConfig.json')

async function main() {

    await hre.run('compile')

    const contracts = getSavedContractAddresses()[hre.network.name]
    const config = conf[hre.network.name]

    // Get congress registry from json
    const congressMembersRegistryAddress = contracts["ChainportCongressMembersRegistry"]
    const congressMembersRegistryInstance = await hre.ethers.getContractAt("ChainportCongressMembersRegistry", congressMembersRegistryAddress)

    const congressAddress = contracts["ChainportCongress"]
    const congressInstance = await hre.ethers.getContractAt("ChainportCongress", congressAddress)
    const connectedMembersRegistryAddress = await congressInstance.getMembersRegistry()

    // Check that congress members registry addresses are equal
    assert.strictEqual(
        congressMembersRegistryAddress,
        connectedMembersRegistryAddress,
        'Registry addresses do not match'
    );

    // Get congress members from both config and deployment
    const connectedMembers = await congressMembersRegistryInstance.getAllMemberAddresses()
    const members = config.initialCongressMembers

    assert.strictEqual(connectedMembers.length, members.length, 'Members do not match')

    //console.log(connectedMembers)
    //console.log(members)

    // Compare members
    let counter = 0;
    for(let i = 0; i < connectedMembers.length; i++){
        for(let j = 0; j < members. length; j++){
            if(connectedMembers[i] === members[j]){
                counter++
                console.log("Found", connectedMembers[i], "+")
                break
            }
        }
    }

    assert.strictEqual(connectedMembers.length, counter, 'Members do not match')
    console.log("Checksum complete - All members are in the registry!")

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.log(error);
        process.exit(1);
    });
