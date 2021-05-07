const { expect } = require("chai");

describe("MaintainersRegistry", function () {

    let contractInstance;
    let maintainersRegistry;
    let chainportCongress;
    let addr1, addr2;
    let maintainers;

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, addr1, addr2, ...maintainers] = await ethers.getSigners();

        contractInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }
    });

    it("Should initialize and make given addresses maintainers", async function () {
        await contractInstance.initialize(maintainers, chainportCongress.address);
        let res;
        for(let i = 0; i < maintainers.length; i++) {
            res = await contractInstance.isMaintainer(maintainers[i]);
            expect(res).to.equal(true);
        }
    });

    describe("Maintainers Functions", function () {
        beforeEach(async function () {
            await contractInstance.initialize(maintainers, chainportCongress.address);
        });

        describe("Adding a maintainer", function () {
            it("Should not let a non congress address add a maintainer", async function () {
                await expect(contractInstance.connect(addr2).addMaintainer(addr1.address))
                    .to.be.revertedWith("MaintainersRegistry: Restricted only to ChainportCongress");
            });

            it("Should add a maintainer (by congress)", async function () {
                await contractInstance.connect(chainportCongress).addMaintainer(addr1.address);
                expect(await contractInstance.isMaintainer(addr1.address)).to.equal(true);
            });

            it("Should not add a same maintainer second time (by congress)", async function () {
                await contractInstance.connect(chainportCongress).addMaintainer(addr1.address);
                expect(await contractInstance.isMaintainer(addr1.address)).to.equal(true);
                await expect(contractInstance.connect(chainportCongress).addMaintainer(addr1.address))
                    .to.be.revertedWith('MaintainersRegistry :: Address is already a maintainer');
            });
        });

        describe("Removing a maintainer", function () {
            it("Should not let a non congress address remove a maintainer", async function () {
                await contractInstance.connect(chainportCongress).addMaintainer(addr1.address);
                expect(await contractInstance.isMaintainer(addr1.address)).to.equal(true);
                await expect(contractInstance.connect(addr2).removeMaintainer(addr1.address))
                    .to.be.revertedWith("MaintainersRegistry: Restricted only to ChainportCongress");
            });

            it("Should remove a maintainer (by congress)", async function () {
                await contractInstance.connect(chainportCongress).addMaintainer(addr1.address);
                expect(await contractInstance.isMaintainer(addr1.address)).to.equal(true);
                await contractInstance.connect(chainportCongress).removeMaintainer(addr1.address);
                expect(await contractInstance.isMaintainer(addr1.address)).to.equal(false);
            });
            it("Should not remove a nonexistent maintainer (by congress)", async function () {
                await expect(contractInstance.connect(chainportCongress).removeMaintainer(addr1.address))
                    .to.be.revertedWith('MaintainersRegistry :: Address is not a maintainer');
            });
        });
    });
});