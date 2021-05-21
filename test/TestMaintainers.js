const { expect } = require("chai");

describe("MaintainersRegistry", function () {

    let maintainersRegistryInstance;
    let maintainersRegistry;
    let chainportCongress;
    let maintainers;
    let user1, user2;

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, maintainer, ...maintainers] = await ethers.getSigners();

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }
        maintainers[maintainers.length] = maintainer.address;
    });

    it("Should initialize and make given addresses maintainers", async function () {
        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);
        let res;
        for(let i = 0; i < maintainers.length; i++) {
            res = await maintainersRegistryInstance.isMaintainer(maintainers[i]);
            expect(res).to.equal(true);
        }
        expect(await maintainersRegistryInstance.chainportCongress()).to.equal(chainportCongress.address);
    });

    describe("Maintainers Functions", function () {
        beforeEach(async function () {
            await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);
        });

        describe("Adding a maintainer", function () {

            it("Should add a maintainer (by congress)", async function () {
                await maintainersRegistryInstance.connect(chainportCongress).addMaintainer(user1.address);
                expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
            });

            it("Should not let add a maintainer (by user)", async function () {
                await expect(maintainersRegistryInstance.connect(user2).addMaintainer(user1.address))
                    .to.be.revertedWith("MaintainersRegistry: Restricted only to ChainportCongress");
            });

            it("Should not let add a maintainer (by maintainer)", async function () {
                await expect(maintainersRegistryInstance.connect(maintainer).addMaintainer(user1.address))
                    .to.be.revertedWith("MaintainersRegistry: Restricted only to ChainportCongress");
            });

            it("Should not add a same maintainer second time (by congress)", async function () {
                await maintainersRegistryInstance.connect(chainportCongress).addMaintainer(user1.address);
                expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
                await expect(maintainersRegistryInstance.connect(chainportCongress).addMaintainer(user1.address))
                    .to.be.revertedWith('MaintainersRegistry :: Address is already a maintainer');
            });
        });

        describe("Removing a maintainer", function () {

            it("Should remove a maintainer (by congress)", async function () {
                await maintainersRegistryInstance.connect(chainportCongress).addMaintainer(user1.address);
                expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
                await maintainersRegistryInstance.connect(chainportCongress).removeMaintainer(user1.address);
                expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(false);
            });

            it("Should not let normal user remove a maintainer", async function () {
                await maintainersRegistryInstance.connect(chainportCongress).addMaintainer(user1.address);
                expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
                await expect(maintainersRegistryInstance.connect(user2).removeMaintainer(user1.address))
                    .to.be.revertedWith("MaintainersRegistry: Restricted only to ChainportCongress");
            });

            it("Should not let maintainer remove a maintainer", async function () {
                await maintainersRegistryInstance.connect(chainportCongress).addMaintainer(user1.address);
                expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
                await expect(maintainersRegistryInstance.connect(maintainer).removeMaintainer(user1.address))
                    .to.be.revertedWith("MaintainersRegistry: Restricted only to ChainportCongress");
            });

            it("Should not remove a nonexistent maintainer (by congress)", async function () {
                await expect(maintainersRegistryInstance.connect(chainportCongress).removeMaintainer(user1.address))
                    .to.be.revertedWith('MaintainersRegistry :: Address is not a maintainer');
            });
        });
    });
});