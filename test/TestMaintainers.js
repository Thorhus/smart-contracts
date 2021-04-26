const MaintainersRegistry = artifacts.require("MaintainersRegistry");
const utils = require("./helpers/utils");

contract("MaintainersRegistry", (accounts) => {

    let contractInstance;
    let [chainportCongress, user] = accounts; //chainportCongress = accounts[0], user = accounts[1]
    let addresses = [accounts[2], accounts[3], accounts[4]];

    beforeEach(async () => {
        contractInstance = await MaintainersRegistry.new();
    })

    it("Should initialize and make given addresses maintainers", async () => {
        await contractInstance.initialize(addresses, chainportCongress);

        for(let i = 0; i < addresses.length; i++){
            assert.equal(await contractInstance.isMaintainer(addresses[i]), true);
        }
    })

    context("Maintainer functions", async () => {

        beforeEach(async () => {
            await contractInstance.initialize(addresses, chainportCongress);
        })

        context("Adding a maintainer", async () => {

            it("Should add a maintainer", async () => {
                await contractInstance.addMaintainer(user, {from: chainportCongress});
                assert.equal(await contractInstance.isMaintainer(user), true);
            })

            it("Should not add a maintainer if address already is a maintainer", async () => {
                await contractInstance.addMaintainer(user, {from: chainportCongress});
                assert.equal(await contractInstance.isMaintainer(user), true);
                utils.shouldThrow(contractInstance.addMaintainer(user, {from: chainportCongress}));
            })
        })

        context("Removing a maintainer", async () => {

            it("Should remove a maintainer", async () => {
                await contractInstance.addMaintainer(user, {from: chainportCongress});
                assert.equal(await contractInstance.isMaintainer(user), true);
                await contractInstance.removeMaintainer(user, {from: chainportCongress});
                assert.equal(await contractInstance.isMaintainer(user), false);
            })

            it("Should not remove maintainer if it doesn't exits", async () => {
                utils.shouldThrow(contractInstance.removeMaintainer(user, {from: chainportCongress}));
            })
        })
    })

})